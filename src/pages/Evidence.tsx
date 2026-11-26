import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { Link } from '@/app/router';
import { looksLikeQuestion } from '@/core/claims/shape';
import type { StepProps } from '@/app/ProjectShell';
import { titleOf } from '@/core/cite/preflight';
import { directionSides, numberSides, scopeSides, type Bit, type Sides } from '@/core/claims/explain';
import { coverage, runGuards } from '@/core/claims/guards';
import { judge, type Judged, type Support } from '@/core/claims/label';
import { startAt } from '@/core/claims/nli';
import { rankSentences } from '@/core/claims/rank';
import { removeClaim, saveClaim } from '@/core/claims/store';
import { cancelSupport, loadSupport, onSupport, scoreSupport, scoreSupportMany, SUPPORT_MB, supportModelLabel, supportState } from '@/core/claims/support';
import { CLAIM_TEXT, REASON_TEXT, type Claim, type ClaimLabel, type Source } from '@/core/contracts';
import { pageAt, pageText } from '@/core/pdf/pages';
import { registries } from '@/core/registries';
import { cancelMeaning, embedder, loadMeaning, meaningSaved, meaningState, onMeaning, unloadMeaning } from '@/core/semantic/meaning';
import { MEANING_MB, MEANING_MODEL } from '@/core/semantic/models';
import { hybridRank, type Candidate } from '@/core/semantic/rank';
import { record as log } from '@/log/log';
import { POLICY } from '@/policy/policy';
import { editSource } from '@/store/actions';
import { db } from '@/store/db';
import { CLAIM_HANDOFF } from '@/pages/Read';
import { ExplainLabel } from '@/pages/ExplainLabel';
import { ClaimStamp, VerdictStamp } from '@/ui/Stamp';
import css from './Evidence.module.css';
import { FixFirst, SeeAlso } from './Signposts';

/** A sentence (or two neighbours) from the source, with its ranking aids. Ranking aids never decide a label. */
type Cand = { text: string; start: number; end: number; words: number; meaning: number | null };
type Row = { source: Source; best: Candidate | undefined; support: Support | null; judged: Judged };

const T = POLICY.thresholds;
const at = (c: { start: number; end: number }): string => `${c.start}:${c.end}`;
const pct = (x: number): string => `${Math.round(x * 100)}%`;
const fixed = (x: number): string => x.toFixed(2);
const ORDER: ClaimLabel[] = ['verified', 'disputed', 'reported', 'ai-reasoning', 'not-found'];

/** The source text with one exact slice marked. */
function Marked({ text, at }: { text: string; at: { start: number; end: number } | undefined }) {
  if (!at) return <>{text}</>;
  return (
    <>
      {text.slice(0, at.start)}
      <mark className={css.mark} key={at.start} ref={(el) => el?.scrollIntoView?.({ block: 'nearest' })}>
        {text.slice(at.start, at.end)}
      </mark>
      {text.slice(at.end)}
    </>
  );
}

/** Model scores and ranking aids in one line, for lists. */
function scoreLine(words: number, meaning: number | null, s: Support | null): string {
  return [`Words shared ${pct(words)}`, meaning !== null ? `meaning match ${fixed(meaning)}` : '', s ? `support ${pct(s.entails)}` : '', s ? `contradiction ${pct(s.contradicts)}` : ''].filter(Boolean).join(' · ');
}

export function Evidence({ project }: StepProps) {
  const sources = useLiveQuery(() => db.sources.where('projectId').equals(project.id).toArray(), [project.id]);
  const claims = useLiveQuery(() => db.claims.where('projectId').equals(project.id).reverse().sortBy('createdAt'), [project.id]) ?? [];
  const model = useSyncExternalStore(onSupport, supportState);
  const meaning = useSyncExternalStore(onMeaning, meaningState);
  const [sourceId, setSourceId] = useState('');
  const [claim, setClaim] = useState('');
  const [cands, setCands] = useState<Cand[] | null>(null);
  const [rankedByMeaning, setRankedByMeaning] = useState(false);
  const [pick, setPick] = useState(0);
  const [scores, setScores] = useState<Record<string, Support>>({});
  const [scoring, setScoring] = useState(false);
  const [moved, setMoved] = useState(false);
  const [byMeaning, setByMeaning] = useState(false);
  const [ranking, setRanking] = useState(false);
  const [saved, setSaved] = useState(false);
  const [note, setNote] = useState('');
  const [rows, setRows] = useState<Row[] | null>(null);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [said, setSaid] = useState('');
  const [was, setWas] = useState<string | null>(null);
  const [fetching, setFetching] = useState(false);
  const run = useRef(0);
  const allRun = useRef(0);
  const chosen = useRef(false);

  const handed = useRef<{ sourceId: string; text: string } | null>(null);
  useEffect(() => {
    // Kept in a ref because React mounts effects twice in development.
    try {
      const raw = sessionStorage.getItem(CLAIM_HANDOFF);
      if (raw) handed.current = JSON.parse(raw) as { sourceId: string; text: string };
      sessionStorage.removeItem(CLAIM_HANDOFF);
    } catch {
      /* storage blocked: start empty */
    }
    if (handed.current) {
      setSourceId(handed.current.sourceId);
      setClaim(handed.current.text);
    }
  }, []);

  useEffect(() => {
    let live = true;
    void meaningSaved().then((s) => live && setSaved(s));
    return () => {
      live = false;
    };
  }, [meaning.status]);

  const kept = sources ?? [];
  const source: Source | undefined = kept.find((s) => s.id === sourceId) ?? kept.find((s) => s.text) ?? kept[0];
  const passage = cands?.[pick];
  const support = passage ? (scores[at(passage)] ?? null) : null;
  const where = source && passage ? pageAt(source, passage.start, passage.end) : null;
  const judged = useMemo(() => (cands && source ? judge(claim, source, passage?.text, support) : null), [cands, source, claim, passage, support]);
  const words = claim.trim().split(/\s+/).filter(Boolean).length;

  function clearResult() {
    run.current++;
    setCands(null);
    setScores({});
    setRanking(false);
    setNote('');
  }

  /** Finds the closest sentences in one source: by shared words, or by meaning and shared words when that is on. */
  async function find(o: { target?: Source | undefined; meaningOn?: boolean } = {}) {
    const target = o.target ?? source;
    setError('');
    setSaid('');
    setReason('');
    setScores({});
    setPick(0);
    setMoved(false);
    setNote('');
    chosen.current = false;
    if (!target) return;
    const text = target.text ?? '';
    const mine = ++run.current;
    const byWords = (): Cand[] => (text ? rankSentences(text, claim).map((r) => ({ text: r.text, start: r.start, end: r.end, words: coverage(claim, r.text), meaning: null })) : []);
    if (!text || !(o.meaningOn ?? byMeaning) || meaningState().status !== 'ready') {
      setRanking(false);
      setRankedByMeaning(false);
      setCands(byWords());
      return;
    }
    setRanking(true);
    try {
      const got = await hybridRank(claim, text, embedder);
      if (mine !== run.current) return;
      setCands(got.map(({ text: t, start, end, words: w, meaning: m }) => ({ text: t, start, end, words: w, meaning: m })));
      setRankedByMeaning(true);
      void log(project.id, 'code', 'meaning.model-ran', `${MEANING_MODEL} on this device | put the sentences of one source in order by meaning and shared words; it decides nothing`);
    } catch {
      if (mine !== run.current) return;
      setCands(byWords());
      setRankedByMeaning(false);
      setNote('Finding by meaning did not work this time, so these sentences were found by shared words only.');
    } finally {
      if (mine === run.current) setRanking(false);
    }
  }

  function toggleMeaning(on: boolean) {
    setByMeaning(on);
    if (on) loadMeaning();
    else {
      unloadMeaning();
      if (cands && rankedByMeaning) void find({ meaningOn: false });
    }
  }

  // When the meaning model arrives, put the shown sentences in order again.
  useEffect(() => {
    if (byMeaning && meaning.status === 'ready' && cands && !rankedByMeaning) void find();
  }, [meaning.status]);

  // Score every shown sentence whenever the support model is ready. On this device, one sentence at a time.
  useEffect(() => {
    if (!cands?.length || model.status !== 'ready') return;
    let live = true;
    const list = cands.slice(0, 4);
    setScoring(true);
    scoreSupportMany(
      list.map((c) => c.text),
      claim,
    )
      .then(async (got) => {
        if (!live) return;
        const next: Record<string, Support> = {};
        got.forEach((s, i) => {
          if (s) next[at(list[i]!)] = s;
        });
        setScores(next);
        // Start on a word-for-word match, else stay on the closest sentence (measured: see startAt).
        // The other sentences keep their scores, and one against the claim is pointed out.
        const best = source ? startAt(list.map((c, i) => judge(claim, source, c.text, got[i] ?? null))) : 0;
        if (!chosen.current && best >= 0) {
          setPick(best);
          setMoved(best > 0);
        }
        for (const s of got) if (s) await log(project.id, 'code', 'support.model-ran', `${supportModelLabel()} on this device | support ${s.entails.toFixed(2)}, neutral ${(s.neutral ?? 0).toFixed(2)}, contradiction ${s.contradicts.toFixed(2)}`);
      })
      .finally(() => live && setScoring(false));
    return () => {
      live = false;
      setScoring(false);
    };
  }, [cands, model.status]);

  /** One row per source: its closest sentence, the scores, and the label judge() gives that pair. */
  async function checkAll() {
    setError('');
    const mine = ++allRun.current;
    const useMeaning = byMeaning && meaningState().status === 'ready';
    const useModel = supportState().status === 'ready';
    const out: Row[] = [];
    setRows([]);
    setProgress({ done: 0, total: kept.length });
    let fellBack = false;
    for (const s of kept) {
      let best: Candidate | undefined;
      let sup: Support | null = null;
      if (s.text?.trim()) {
        try {
          best = (await hybridRank(claim, s.text, useMeaning ? embedder : undefined, { max: 1 }))[0];
        } catch {
          fellBack = true;
          best = (await hybridRank(claim, s.text, undefined, { max: 1 }))[0];
        }
        if (best && useModel) {
          sup = await scoreSupport(best.text, claim).catch(() => null);
          if (sup) await log(project.id, 'code', 'support.model-ran', `${supportModelLabel()} on this device | support ${sup.entails.toFixed(2)}, neutral ${(sup.neutral ?? 0).toFixed(2)}, contradiction ${sup.contradicts.toFixed(2)}`);
        }
      }
      if (mine !== allRun.current) return;
      out.push({ source: s, best, support: sup, judged: judge(claim, s, best?.text, sup) });
      setRows([...out]);
      setProgress({ done: out.length, total: kept.length });
    }
    setProgress(null);
    if (fellBack) setNote('Finding by meaning did not work for every source, so some were matched by shared words only.');
    if (useMeaning) await log(project.id, 'code', 'meaning.model-ran', `${MEANING_MODEL} on this device | put the sentences of ${out.length} sources in order by meaning and shared words; it decides nothing`);
    const count = (l: ClaimLabel) => out.filter((r) => r.judged.label === l).length;
    await log(project.id, 'code', 'evidence.all-sources', `${out.length} sources | ${count('verified')} verified, ${count('disputed')} disputed, ${count('reported')} reported | ${useMeaning ? 'by meaning and shared words' : 'by shared words'}${useModel ? ', support model on this device' : ''}`);
  }

  function openRow(r: Row) {
    setSourceId(r.source.id);
    void find({ target: r.source });
    document.querySelector<HTMLTextAreaElement>(`.${css.claim}`)?.scrollIntoView?.({ block: 'start' });
  }

  async function getText(s: Source) {
    setFetching(true);
    setError('');
    try {
      const rec = s.record?.doi ? await registries.openalexByDoi(s.record.doi) : null;
      if (rec?.abstract) await editSource(s.id, { text: rec.abstract, textOrigin: 'abstract' });
      else setError('OpenAlex has no abstract for this source. Add its PDF instead.');
    } catch {
      setError('OpenAlex did not answer. Try again in a minute, or add the PDF.');
    }
    setFetching(false);
  }

  async function decide(decision: 'accepted' | 'rejected') {
    setError('');
    try {
      const c = await saveClaim({
        projectId: project.id,
        text: claim,
        decision: decision === 'accepted' && was && was !== claim.trim() ? 'rewritten' : decision,
        support,
        reason,
        ...(source ? { source } : {}),
        ...(passage ? { passage: { text: passage.text, start: passage.start, end: passage.end }, match: { words: passage.words, meaning: passage.meaning } } : {}),
      });
      setSaid(decision === 'rejected' ? 'Rejected. It stays in the log.' : `Saved as ${CLAIM_TEXT[c.label].label}.`);
      clearResult();
      allRun.current++;
      setRows(null);
      setProgress(null);
      setClaim((now) => (now === claim ? '' : now));
      setReason('');
      setWas(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'That did not work.');
    }
  }

  if (!sources) return <p className="soft">Opening your library…</p>;
  if (kept.length === 0)
    return (
      <>
        <h1>Evidence</h1>
        <div className={`card ${css.empty}`}>
          <h2>No sources to look in yet</h2>
          <p className="soft">
            <Link to={`/p/${project.id}/find`}>Keep a source</Link> first. Then write a claim and we show you the exact sentence that supports it, or say that none does.
          </p>
          <FixFirst project={project} />
        </div>
      </>
    );

  const t = judged && CLAIM_TEXT[judged.label];
  const against = cands?.findIndex((c, i) => i !== pick && (scores[at(c)]?.contradicts ?? 0) >= T.contradiction) ?? -1;
  const readable = kept.filter((s) => s.text?.trim()).length;
  return (
    <>
      <div className="stack">
        <h1>Evidence</h1>
        <p className="soft">Write what you want to say. We show the closest sentence in the source and whether it says the same.</p>
        <SeeAlso from="evidence" />
      </div>

      <form
        className={css.ask}
        onSubmit={(e) => {
          e.preventDefault();
          void find();
        }}
      >
        <label className="stack">
          <strong>Source</strong>
          <select
            className="field"
            value={source?.id ?? ''}
            onChange={(e) => {
              setSourceId(e.target.value);
              clearResult();
              setError('');
            }}
          >
            {kept.map((s) => (
              <option key={s.id} value={s.id}>
                {titleOf(s).slice(0, 110)}
                {s.text ? '' : ' (no text yet)'}
              </option>
            ))}
          </select>
        </label>
        <label className="stack">
          <strong>Your claim</strong>
          <textarea
            className={`field ${css.claim}`}
            value={claim}
            placeholder="Home working led to a 13% performance increase."
            onChange={(e) => {
              setClaim(e.target.value);
              clearResult();
              allRun.current++;
              setRows(null);
              setProgress(null);
            }}
          />
        </label>
        {looksLikeQuestion(claim) && (
          <p className="soft" role="note">
            This reads like a question or a task, not a claim. Evidence checks a sentence you want to write, such as “Home working led to a 13% performance increase.” To ask your sources a question, use <Link to={`/p/${project.id}/ask`}>Ask</Link>.
          </p>
        )}
        <MeaningSwitch on={byMeaning} state={meaning} saved={saved} onToggle={toggleMeaning} onCancel={() => {
          cancelMeaning();
          setByMeaning(false);
        }} />
        <div className="row">
          <button className="btn main" type="submit" disabled={words < 3 || !source?.text || ranking}>
            {ranking ? 'Finding…' : 'Find the sentence'}
          </button>
          <button className="btn" type="button" disabled={words < 3 || !readable || !!progress} onClick={() => void checkAll()}>
            Check against all my sources
          </button>
          {source?.check && <VerdictStamp verdict={source.check.verdict} />}
          {source?.textOrigin === 'abstract' && <span className="soft">Only the abstract can be read.</span>}
        </div>
        {source && !source.text && (
          <div className={css.notext}>
            <p>We have no text for this source, so nothing can be compared with it.</p>
            <div className="row">
              {source.record?.doi && (
                <button className="btn" type="button" disabled={fetching} onClick={() => void getText(source)}>
                  {fetching ? 'Asking OpenAlex…' : 'Get the abstract'}
                </button>
              )}
              <Link to={`/p/${project.id}/library`}>Add its PDF in the library</Link>
            </div>
          </div>
        )}
      </form>
      {ranking && (
        <p role="status" className="soft">
          Putting the sentences in order by meaning…
        </p>
      )}
      {note && <p className={css.note}>{note}</p>}

      {cands && source && judged && (
        <section className={css.result} aria-label="Result">
          <div className={css.left}>
            <h2>In the source</h2>
            {passage ? (
              <>
                <p className={css.page}>{where ? pageText(where) : source.textOrigin === 'abstract' ? 'In the abstract, which has no page numbers. Add the PDF to get one.' : 'This text has no page numbers.'}</p>
                <p className={css.source} tabIndex={0} role="region" aria-label="Text of the source">
                  <Marked text={source.text!} at={passage} />
                </p>
                {cands.length > 1 && (
                  <fieldset className={css.others}>
                    <legend>{rankedByMeaning ? 'Closest by meaning and shared words' : 'Closest sentences'}</legend>
                    {cands.map((c, i) => {
                      const s = scores[at(c)] ?? null;
                      return (
                        <label key={at(c)}>
                          <input
                            type="radio"
                            name="sentence"
                            checked={pick === i}
                            onChange={() => {
                              chosen.current = true;
                              setMoved(false);
                              setPick(i);
                            }}
                          />{' '}
                          <span className={css.cand}>
                            <span>{c.text}</span>
                            <span className={css.candScores}>{scoreLine(c.words, c.meaning, s)}</span>
                            {s && s.contradicts >= T.contradiction && <span className={css.against}>The model reads this sentence as saying the opposite of your claim.</span>}
                          </span>
                        </label>
                      );
                    })}
                  </fieldset>
                )}
              </>
            ) : (
              <>
                <p className={css.none}>No sentence in this source is close to your claim.</p>
                {!byMeaning && <p className="soft">Turn on Find by meaning to look for a sentence that says it in other words.</p>}
                <p className={css.source} tabIndex={0} role="region" aria-label="Text of the source">
                  {source.text}
                </p>
              </>
            )}
          </div>
          <div className={css.right} data-label={judged.label}>
            <h2 className={css.cardTitle}>Claim scorecard</h2>
            <div role="status" aria-live="polite" className="stack">
              <span className="land" key={judged.label}>
                <ClaimStamp label={judged.label} />
              </span>
              <p>{t!.plain}</p>
              {judged.reasons.length > 0 && (
                <ul className={css.reasons}>
                  {judged.reasons.map((r) => (
                    <li key={r}>{REASON_TEXT[r]}</li>
                  ))}
                </ul>
              )}
            </div>
            {moved && <p className="soft">We started on sentence {pick + 1} because it says your claim word for word.</p>}
            {against >= 0 && (
              <p className={css.against}>
                Another close sentence may say the opposite: number {against + 1} in the list. Read it before you decide.
              </p>
            )}
            {passage && <Checks claim={claim} passage={passage.text} judged={judged} />}
            {passage && <ModelScores support={support} scoring={scoring} wordForWord={judged.wordForWord} />}
            {passage && <Aids words={passage.words} meaning={passage.meaning} />}
            {passage && <ExplainLabel project={project} claim={claim} sentence={passage.text} judged={judged} support={support} busy={scoring} />}
            {judged.wordForWord && words >= 8 && <p className={css.own}>These are the source’s own words. Put them in quotation marks, or say it in your own words.</p>}
            {!judged.wordForWord && passage && <ModelBox state={model} />}
            <div className={css.decide}>
              <p>
                <strong>Gate 3.</strong> Your decision.
              </p>
              {judged.label !== 'verified' && (
                <label className="stack">
                  <span>
                    To keep this anyway, say why. <span className="soft">At least {POLICY.overrideReasonMinChars} characters.</span>
                  </span>
                  <textarea className="field" rows={2} value={reason} onChange={(e) => setReason(e.target.value)} />
                </label>
              )}
              <div className="row">
                <button className="btn main" type="button" disabled={scoring || ranking} onClick={() => void decide('accepted')}>
                  Accept
                </button>
                <button
                  className="btn"
                  type="button"
                  onClick={() => {
                    setWas(claim.trim());
                    clearResult();
                    document.querySelector<HTMLTextAreaElement>(`.${css.claim}`)?.focus();
                  }}
                >
                  Rewrite
                </button>
                <button className="btn quiet" type="button" onClick={() => void decide('rejected')}>
                  Reject
                </button>
              </div>
            </div>
          </div>
        </section>
      )}
      {error && (
        <p role="alert" className={css.error}>
          {error}
        </p>
      )}
      <p role="status" className="soft">
        {said}
      </p>

      {rows && <AllSources rows={rows} progress={progress} byMeaning={byMeaning && meaning.status === 'ready'} modelOn={model.status === 'ready'} onOpen={openRow} />}

      {claims.length > 0 && (
        <section className="stack">
          <h2>Your claims ({claims.length})</h2>
          <ul className={css.list}>
            {claims.map((c) => (
              <ClaimCard key={c.id} c={c} source={kept.find((s) => s.id === c.sourceId)} />
            ))}
          </ul>
        </section>
      )}
    </>
  );
}

function MeaningSwitch({ on, state, saved, onToggle, onCancel }: { on: boolean; state: ReturnType<typeof meaningState>; saved: boolean; onToggle: (on: boolean) => void; onCancel: () => void }) {
  return (
    <div className={css.switch}>
      <label className={css.toggle}>
        <input type="checkbox" checked={on} onChange={(e) => onToggle(e.target.checked)} /> <strong>Find by meaning</strong>
      </label>
      {state.status === 'loading' ? (
        <div className={css.model}>
          <label className="stack">
            <span>
              {saved ? 'Loading the meaning model from this browser' : 'Downloading the meaning model'}
              {state.total ? `, ${Math.round(state.loaded / 1e6)} of ${Math.round(state.total / 1e6)} MB` : ''}
            </span>
            <progress {...(state.total ? { value: state.loaded, max: state.total } : {})} />
          </label>
          <button className="btn" type="button" onClick={onCancel}>
            Cancel
          </button>
        </div>
      ) : state.status === 'ready' && on ? (
        <p className="soft">On. Sentences are put in order by meaning and by shared words. Neither decides the label.</p>
      ) : (
        <p className="soft">
          Also finds sentences that say it in other words. {saved ? 'The model is already saved in this browser.' : `It downloads about ${MEANING_MB} MB once, then loads from this browser.`} Your claim stays on this device.
        </p>
      )}
      {state.status === 'failed' && on && <p role="alert">{state.why}</p>}
    </div>
  );
}

function Diff({ bits }: { bits: Bit[] }) {
  if (!bits.length) return <span className="soft">none</span>;
  return (
    <>
      {bits.map((b, i) => (
        <span key={`${b.text}-${i}`}>
          {i > 0 && ', '}
          {b.differs ? <strong className={css.diff}>{b.text}</strong> : b.text}
        </span>
      ))}
    </>
  );
}

function SideBySide({ sides }: { sides: Sides | null }) {
  if (!sides) return null;
  return (
    <span className={css.sides}>
      You: <Diff bits={sides.you} /> · Source: <Diff bits={sides.source} />
    </span>
  );
}

/** The plain-code checks, with what each side says. The values come from judge(). */
function Checks({ claim, passage, judged }: { claim: string; passage: string; judged: Judged }) {
  const g = useMemo(() => runGuards(claim, passage), [claim, passage]);
  const rows: [string, boolean | null, Sides | null, string?][] = [
    ['Numbers match, for the same thing', judged.checks.numbers, numberSides(claim, passage), g.numbers === 'conflict' ? 'differs' : g.numbers === 'missing' ? 'not in this sentence' : undefined],
    ['Same direction', judged.checks.direction, directionSides(claim, passage), g.direction === 'conflict' || g.negation === 'conflict' ? 'the opposite' : g.direction === 'missing' || g.negation === 'missing' ? 'unclear' : undefined],
    ['Not wider or more certain', judged.checks.scope, scopeSides(claim, passage), g.scope === 'conflict' ? 'goes further' : g.scope === 'missing' ? 'not covered' : undefined],
  ];
  return (
    <table className={css.checks}>
      <tbody>
        <tr data-v={judged.wordForWord ? 'true' : 'null'}>
          <th scope="row">Your words appear in the source</th>
          <td>{judged.wordForWord ? '✓ word for word' : 'no, in your own words'}</td>
        </tr>
        {rows.map(([name, v, sides, why]) => (
          <tr key={name} data-v={String(v)}>
            <th scope="row">
              {name}
              <SideBySide sides={sides} />
            </th>
            <td>{v === true ? '✓ yes' : v === false ? `≠ no${why ? `, ${why}` : ''}` : 'nothing to check'}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function Bar({ name, value, shown, tone, mark }: { name: string; value: number; shown: string; tone: 'model' | 'neutral' | 'against' | 'aid'; mark?: number }) {
  return (
    <div className={css.bar} data-tone={tone}>
      <span>{name}</span>
      <span className={css.value}>{shown}</span>
      <span className={css.track} aria-hidden="true">
        <i style={{ width: `${Math.max(0, Math.min(1, value)) * 100}%` }} />
        {mark !== undefined && <b style={{ left: `${mark * 100}%` }} />}
      </span>
    </div>
  );
}

/** What the support model says about this one sentence, with the lines the policy draws. */
function ModelScores({ support, scoring, wordForWord }: { support: Support | null; scoring: boolean; wordForWord: boolean }) {
  return (
    <div className={css.scores}>
      <h3>Meaning, from the model on this device</h3>
      {support ? (
        <>
          <Bar name="Support" value={support.entails} shown={pct(support.entails)} tone="model" mark={T.supportVerified} />
          <p className={css.rule}>The line is at {pct(T.supportVerified)}. Verified needs support at or above it, and every check passing.</p>
          <Bar name="Neutral" value={support.neutral ?? 0} shown={support.neutral === undefined ? 'not given' : pct(support.neutral)} tone="neutral" />
          <Bar name="Contradiction" value={support.contradicts} shown={pct(support.contradicts)} tone="against" mark={T.contradiction} />
          <p className={css.rule}>The line is at {pct(T.contradiction)}. At or above it the label is Disputed.</p>
          <p className="soft">How this one sentence relates to your claim. It is not the chance that your claim is true.</p>
        </>
      ) : scoring ? (
        <p role="status">Comparing the meaning…</p>
      ) : (
        <p className="soft">{wordForWord ? 'Not needed: your words are the source’s own.' : 'Not compared yet.'}</p>
      )}
    </div>
  );
}

function Aids({ words, meaning }: { words: number; meaning: number | null }) {
  return (
    <div className={css.scores}>
      <h3>Ranking aids</h3>
      <p className="soft">These put sentences in order. They never decide the label.</p>
      {meaning !== null ? <Bar name="Meaning match" value={meaning} shown={fixed(meaning)} tone="aid" /> : <p className="soft">Meaning match: turn on Find by meaning to see it.</p>}
      <Bar name="Words shared" value={words} shown={pct(words)} tone="aid" />
    </div>
  );
}

function AllSources({ rows, progress, byMeaning, modelOn, onOpen }: { rows: Row[]; progress: { done: number; total: number } | null; byMeaning: boolean; modelOn: boolean; onOpen: (r: Row) => void }) {
  const sorted = [...rows].sort((a, b) => ORDER.indexOf(a.judged.label) - ORDER.indexOf(b.judged.label) || (b.support?.entails ?? -1) - (a.support?.entails ?? -1) || (b.best?.fused ?? 0) - (a.best?.fused ?? 0));
  return (
    <section className="stack" aria-label="All your sources">
      <h2>Against all your sources</h2>
      <p className="soft">
        One row for each source: its closest sentence, its scores and its label. {byMeaning ? 'Found by meaning and shared words.' : 'Found by shared words.'} {modelOn ? '' : 'Turn on Compare the meaning, under a result, to add support scores.'}
      </p>
      {progress && (
        <p role="status">
          Checking {progress.done} of {progress.total} sources…
        </p>
      )}
      <ul className={css.list}>
        {sorted.map((r) => (
          <li key={r.source.id} className={`card ${css.card}`} data-label={r.judged.label}>
            <p className={css.text}>{titleOf(r.source)}</p>
            <div className="row">
              <ClaimStamp label={r.judged.label} />
              {r.best && (
                <button className="btn quiet" type="button" onClick={() => onOpen(r)}>
                  Open this source
                </button>
              )}
            </div>
            {r.best ? <blockquote>“{r.best.text}”</blockquote> : <p className="soft">{r.source.text?.trim() ? 'No close sentence in this source.' : 'No text for this source yet. Get its abstract or add the PDF.'}</p>}
            {r.best && <p className="soft">{scoreLine(r.best.words, r.best.meaning, r.support)}</p>}
            {r.judged.reasons.length > 0 && <p className="soft">{r.judged.reasons.map((x) => REASON_TEXT[x]).join(' ')}</p>}
          </li>
        ))}
      </ul>
    </section>
  );
}

/** What was stored with a saved claim. */
function savedScores(c: Claim): string[] {
  const ch = c.checks;
  const out: string[] = [];
  if (ch.wordForWord !== undefined) out.push(ch.wordForWord ? 'Your words appear in the source' : 'In your own words');
  const g = (v: boolean | null, yes: string, no: string) => (v === null ? '' : v ? yes : no);
  const guards = [g(ch.numbers, 'numbers match', 'numbers differ'), g(ch.direction, 'same direction', 'direction differs'), g(ch.scope, 'not wider', 'wider or more certain')].filter(Boolean);
  if (guards.length) out.push(guards.join(' · ').replace(/^./, (x) => x.toUpperCase()));
  if (ch.support !== null) out.push(`Support ${pct(ch.support)}${typeof ch.neutral === 'number' ? ` · neutral ${pct(ch.neutral)}` : ''}${ch.contradiction !== null ? ` · contradiction ${pct(ch.contradiction)}` : ''}, from the model on this device`);
  if (c.match) out.push(`Words shared ${pct(c.match.words)}${c.match.meaning !== null ? ` · meaning match ${fixed(c.match.meaning)}` : ''}. Ranking aids only.`);
  return out;
}

function ClaimCard({ c, source }: { c: Claim; source: Source | undefined }) {
  const stored = c.passage ? savedScores(c) : [];
  return (
    <li className={`card ${css.card}`} data-decision={c.decision}>
      <p className={css.text}>{c.text}</p>
      <div className="row">
        <ClaimStamp label={c.label} />
        <span className="soft">{c.decision === 'accepted' ? 'You accepted this' : c.decision === 'rewritten' ? 'You rewrote and accepted this' : 'You rejected this'}</span>
        <button className="btn quiet" type="button" onClick={() => void removeClaim(c.id)}>
          Remove
        </button>
      </div>
      {c.passage && <blockquote>“{c.passage.text}”</blockquote>}
      {c.passage && (
        <p className="soft">
          {source ? titleOf(source) : 'The source was removed from your library.'}
          {c.passage.page ? ` · ${pageText({ ...c.passage, page: c.passage.page })}` : ''}
        </p>
      )}
      {stored.length > 0 && (
        <ul className={css.stored}>
          {stored.map((x) => (
            <li key={x}>{x}</li>
          ))}
        </ul>
      )}
      {c.reasons.length > 0 && <p className="soft">{c.reasons.map((r) => REASON_TEXT[r]).join(' ')}</p>}
      {c.keptWithReason && <p className={css.why}>Your reason: {c.keptWithReason}</p>}
    </li>
  );
}

function ModelBox({ state }: { state: ReturnType<typeof supportState> }) {
  if (state.status === 'ready') return <p className="soft">The support model is on this device. It scores each close sentence and writes nothing.</p>;
  if (state.status === 'loading')
    return (
      <div className={css.model}>
        <label className="stack">
          <span>
            Downloading the support model{state.total ? `, ${Math.round(state.loaded / 1e6)} of ${Math.round(state.total / 1e6)} MB` : ''}
          </span>
          <progress {...(state.total ? { value: state.loaded, max: state.total } : {})} />
        </label>
        <button className="btn" type="button" onClick={cancelSupport}>
          Cancel
        </button>
      </div>
    );
  return (
    <div className={css.model}>
      {state.status === 'failed' && <p role="alert">{state.why}</p>}
      <p className="soft">Your words differ from the source’s. A small model can compare the meaning on this device. It downloads about {SUPPORT_MB} MB once, and your claim is not sent anywhere.</p>
      <button className="btn" type="button" onClick={() => loadSupport()}>
        Compare the meaning
      </button>
    </div>
  );
}
