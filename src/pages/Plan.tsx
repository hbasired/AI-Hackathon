import { useState } from 'react';
import { go } from '@/app/router';
import type { StepProps } from '@/app/ProjectShell';
import { askAi, SearchPhrases } from '@/core/aiClient';
import { suggestQueries } from '@/core/suggest';
import { record as log } from '@/log/log';
import { agentAllowed } from '@/policy/policy';
import { approvePlan, recordAiDecision } from '@/store/actions';
import { AiMark } from '@/ui/Stamp';
import css from './Plan.module.css';

export function Plan({ project }: StepProps) {
  const [queries, setQueries] = useState<string[]>(project.plan?.queries ?? suggestQueries(project.question));
  const [fromYear, setFromYear] = useState(String(project.plan?.fromYear ?? ''));
  const [error, setError] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [fromAi, setFromAi] = useState<string[]>([]);
  const mayAsk = agentAllowed('planner', project.aiLevel);

  async function suggest() {
    setBusy(true);
    setNote('');
    const r = await askAi(project, 'plan', { question: project.question, current: queries.filter(Boolean) }, SearchPhrases);
    setBusy(false);
    if (r.ok && r.data.queries.length) {
      setQueries((cur) => [...new Set([...cur.filter(Boolean), ...r.data.queries])].slice(0, 5));
      setFromAi((cur) => [...new Set([...cur, ...r.data.queries])]);
      setNote(`Suggested by AI (${r.model}). Change or remove anything before you approve.`);
      return;
    }
    const why = r.ok ? 'The AI had no usable suggestion' : r.reason === 'cap' ? 'This project has used all its AI calls' : r.reason === 'locked' ? 'AI is locked at this level' : 'The AI is not available';
    setQueries((cur) => [...new Set([...cur.filter(Boolean), ...suggestQueries(project.question)])].slice(0, 5));
    setNote(`${why}, so these suggestions come from plain code.`);
    void log(project.id, 'code', 'planner.fallback', why);
  }

  async function approve() {
    const y = Number(fromYear);
    if (fromYear && !(y >= 1500 && y <= 2100)) {
      setError('Use a four-digit year, or leave it empty.');
      return;
    }
    try {
      await approvePlan(project.id, { queries, ...(fromYear ? { fromYear: y } : {}) });
      if (fromAi.length) {
        const final = queries.map((q) => q.trim());
        await recordAiDecision(project.id, 'plan', { kept: fromAi.filter((q) => final.includes(q)), changed: [], rejected: fromAi.filter((q) => !final.includes(q)) });
      }
      go(`/p/${project.id}/find`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save the plan.');
    }
  }

  return (
    <>
      <div className="stack">
        <h1>Plan the search</h1>
        <p className="soft">These are the searches we will run. Change them until they say what you mean. Nothing is searched until you approve.</p>
      </div>
      <ol className={css.list}>
        {queries.map((q, i) => (
          <li key={i}>
            <label className="sr" htmlFor={`query-${i}`}>
              Search {i + 1}
            </label>
            <input id={`query-${i}`} className="field" value={q} onChange={(e) => setQueries((c) => c.map((x, k) => (k === i ? e.target.value : x)))} />
            <button className="btn quiet" type="button" onClick={() => setQueries((c) => c.filter((_, k) => k !== i))} aria-label={`Remove search ${i + 1}`}>
              Remove
            </button>
            {fromAi.includes(q) && <AiMark />}
          </li>
        ))}
      </ol>
      <div className="row">
        <button className="btn" type="button" disabled={queries.length >= 5} onClick={() => setQueries((c) => [...c, ''])}>
          Add a search
        </button>
        {mayAsk ? (
          <button className="btn" type="button" disabled={busy || queries.length >= 5} onClick={() => void suggest()}>
            {busy ? 'Asking…' : 'Suggest searches'}
          </button>
        ) : (
          <span className="soft">AI suggestions are locked at level {project.aiLevel}.</span>
        )}
        <label className={css.year}>
          Only from year
          <input className="field" inputMode="numeric" placeholder="any" value={fromYear} onChange={(e) => setFromYear(e.target.value.trim())} />
        </label>
      </div>
      {note && (
        <p role="status" className="soft">
          {note}
        </p>
      )}
      {error && (
        <p role="alert" className={css.error}>
          {error}
        </p>
      )}
      <div className={css.gate}>
        <p>
          <strong>Gate 1.</strong> One search looks for criticism on purpose, so you see both sides.
        </p>
        <button className="btn main" type="button" onClick={() => void approve()}>
          Approve plan and search
        </button>
      </div>
    </>
  );
}
