import type { RawReference } from '@/core/contracts';
import { findDoi, tokens } from './normalise';

/**
 * Turns pasted text into references. Text in, guesses out. Nothing found here is trusted:
 * every field is compared with a registry before it gets a verdict.
 */

const YEAR_PAREN = /\((\d{4})[a-z]?(?:,[^)]*)?\)/;
// Any year from 1500, so old papers keep their year. A number inside a page range (1650–1660) is not a year.
const ANY_YEAR = /(?<![\d–—-])\b(1[5-9]\d{2}|20\d{2})\b(?!\s*[–—-]\s*\d)/g;
const QUOTED_TITLE = /[“"]([^”"]{8,300}?)[,.?!]?[”"]/;
/** Harvard puts titles in single quotes. The closing one is followed by a comma or a full stop, so ’s inside a title is safe. */
const SINGLE_QUOTED = /^[‘'](.{8,300}?)[’'](?=[,.]|\s*$)/u;
const NUMBERED = /^\s*(?:\[\d{1,3}\]|\d{1,3}[.)])\s+/;

/** arXiv gives every preprint a DOI, so "arXiv:2203.02155" can be looked up like any other work. */
const ARXIV = [/arxiv\.org\/(?:abs|pdf)\/(\d{4})\.(\d{4,5})/i, /\barxiv\s*:\s*(\d{4})\.?(\d{4,5})(?:v\d+)?\b/i];
const arxivDoi = (s: string): string | undefined => {
  for (const re of ARXIV) {
    const m = s.match(re);
    if (m) return `10.48550/arxiv.${m[1]}.${m[2]}`;
  }
  return undefined;
};

/** "Hagendorff T, Fabi S, Kosinski M. Title. Journal" */
const VANCOUVER = /^((?:[\p{Lu}][\p{L}’'\-]+(?:\s[\p{Lu}][\p{L}’'\-]+)?\s\p{Lu}{1,3}(?:,\s+|(?=\.)))+(?:et al)?)\.\s+(.{6,300}?)[.?!](?:\s|$)/u;
/** "Leahy, S. & Mishra, P. Title. Journal" and "Ouyang, L. et al. Title (2022)" */
const NATURE = /^((?:[\p{Lu}][\p{L}’'\- ]+,\s+(?:\p{Lu}\.[\s\-]*)+(?:,\s*|&\s*|and\s+)*)+(?:et al\.\s+)?)(.{6,300}?)(?:[.?!](?:\s|$)|\s*\((?:1[5-9]|20)\d{2}\)|$)/u;

/** "Bloom, N., Liang, J., & Ying, Z. J." or "Bloom N, Liang J" or "N. Bloom, J. Liang and Z. Ying" */
export function parseAuthors(s: string): string[] {
  const t = s
    .replace(/\bet al\.?/gi, '')
    .replace(/\(eds?\.\)/gi, '')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[.,;:\s]+$/, '');
  if (!t) return [];
  const out: string[] = [];
  const apa = [...t.matchAll(/([\p{L}][\p{L}’'\-‐-― ]*?),\s*((?:\p{Lu}\.?[\s\-]*){1,4})(?=,|&|;|$|\sand\s|\.{3}|…)/gu)];
  if (apa.length) {
    for (const m of apa) out.push(m[1]!.replace(/^(?:&|and|\.{3}|…)\s*/i, '').trim());
    return out.filter(Boolean);
  }
  // MLA and Chicago write the first author as "Krugman, Paul" and the rest as "Given Family".
  const mla = t.match(/^([\p{Lu}][\p{L}’'\-]+),\s+\p{Lu}[\p{L}\-]+(?:\s+\p{Lu}\.?)*(?=$|,|\s+and\b|\s*&)/u);
  let restText = t;
  if (mla) {
    out.push(mla[1]!);
    restText = t.slice(mla[0].length).replace(/^\s*(?:,|&|and\b)\s*/i, '');
  }
  for (const part of restText.split(/\s*(?:,|;|&|\band\b)\s*/i)) {
    const w = part.replace(/\b\p{Lu}\.\s*/gu, '').replace(/\s+\p{Lu}{1,3}$/u, '').trim();
    const words = w.split(' ').filter(Boolean);
    if (words.length) out.push(words[words.length - 1]!);
  }
  return out.filter((x) => x.length > 1);
}

/** Words whose full stop does not end a title: "A letter of Mr. Isaac Newton", "Dr. Jekyll", "St. Kilda", "vs. Germany". */
const ABBREVIATION = /(?:^|[\s(])(?:Mr|Mrs|Ms|Messrs|Dr|St|Ste|Prof|Rev|Revd|Sr|Jr|Mt|Ft|Gen|Col|Capt|Lt|Gov|Sen|Hon|vs|viz|cf|approx|ca|Vol|Nos?|Fig|Figs|Eq|Eqs|Ed|Eds|Co|Inc|Ltd|Bros|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sept?|Oct|Nov|Dec)$/i;
/** Where an APA or Harvard title ends: the first full stop, question or exclamation mark before a capital or a digit. */
function titleEnd(s: string): number {
  for (const m of s.matchAll(/[.?!](?=\s+[\p{Lu}\d]|\s*$)/gu)) {
    const i = m.index!;
    if (i < 6 || i > 300) continue;
    const before = s.slice(0, i);
    // An initial (J. or U.S.) or an abbreviation is not the end of the title.
    if (m[0] === '.' && (/[A-Z.]$/.test(before) || ABBREVIATION.test(before))) continue;
    return i;
  }
  return -1;
}

/** Reads one reference written in APA, Harvard, IEEE, MLA or Chicago style, as far as it can. */
export function parseReference(line: string): RawReference {
  const raw = line.replace(/\s+/g, ' ').trim();
  const doi = findDoi(raw);
  const url = raw.match(/https?:\/\/[^\s)]+/i)?.[0]?.replace(/[.,;]+$/, '');
  const body = raw
    .replace(NUMBERED, '')
    .replace(/https?:\/\/[^\s]+/gi, '')
    .replace(/\bdoi\s*:?\s*/gi, '')
    .replace(/\b10\.\d{4,9}\/\S+/g, '')
    .replace(/\[preprint\]\.?/gi, '')
    .replace(/\barxiv(?:\s+preprint)?(?:\s+arxiv)?\s*:?\s*(?:\d{4}\.?\d{4,5}(?:v\d+)?)?(?:\s*\[[\w.-]+\])?\.?/gi, '')
    .replace(/\b(?:accessed|available (?:from|online|at))\b:?.*$/i, '')
    .replace(/\s+/g, ' ')
    .trim();
  const ref: RawReference = { raw };
  const arxiv = doi ? undefined : arxivDoi(raw);
  if (doi ?? arxiv) ref.doi = (doi ?? arxiv)!;
  if (url && !/doi\.org/i.test(url)) ref.url = url;

  const y = body.match(YEAR_PAREN);
  // The year comes last in Nature style, so the title is before it.
  const yearLast = !!y && y.index !== undefined && body.slice(y.index + y[0].length).replace(/[.,;:\s]/g, '').length < 12;
  const named = yearLast || !y ? (body.match(VANCOUVER) ?? body.match(NATURE)) : null;
  if (named) {
    const authors = /\p{Lu}\./u.test(named[1]!) ? parseAuthors(named[1]!.replace(/&/g, ',')) : named[1]!.split(/,\s*/).map((a) => a.replace(/\s\p{Lu}{1,3}$/u, '').replace(/^et al$/i, '').trim()).filter((a) => a.length > 1);
    if (authors.length) ref.authors = authors;
    ref.title = named[2]!.replace(/\s*\[[^\]]*\]$/, '').trim();
    const years = [...body.slice(named[0].length - 8).matchAll(ANY_YEAR)].map((m) => Number(m[1]));
    if (years.length) ref.year = years[years.length - 1]!;
  } else if (y && y.index !== undefined && y.index < 400) {
    ref.year = Number(y[1]);
    const before = body.slice(0, y.index);
    const after = body.slice(y.index + y[0].length).replace(/^[.,:\s]+/, '');
    if (before.trim().length > 1) {
      const authors = parseAuthors(before);
      if (authors.length) ref.authors = authors;
    }
    const quoted = after.match(SINGLE_QUOTED) ?? after.match(QUOTED_TITLE) ?? before.match(QUOTED_TITLE);
    if (quoted) ref.title = quoted[1]!.trim();
    else {
      const end = titleEnd(after);
      const title = (end >= 0 ? after.slice(0, end) : after.length <= 300 ? after.replace(/[.?!]$/, '') : (after.split(/\.\s/)[0] ?? '')).trim();
      const q = end >= 0 && after[end] === '?' ? '?' : '';
      if (title) ref.title = (title + q).replace(/\s*\[[^\]]*\]$/, '');
      const rest = after.slice((end >= 0 ? end : title.length) + 1).trim();
      const cont = rest.match(/^([^,.\d]{3,120})/);
      if (cont) ref.container = cont[1]!.trim();
    }
  } else {
    const quoted = body.match(QUOTED_TITLE);
    const years = [...body.matchAll(ANY_YEAR)].map((m) => Number(m[1]));
    if (years.length) ref.year = years[years.length - 1]!;
    if (quoted && quoted.index !== undefined) {
      ref.title = quoted[1]!.trim();
      const authors = parseAuthors(body.slice(0, quoted.index));
      if (authors.length) ref.authors = authors;
    }
  }
  return ref;
}

export function parseBibtex(text: string): RawReference[] {
  const out: RawReference[] = [];
  for (const m of text.matchAll(/@(\w+)\s*\{\s*[^,]*,([\s\S]*?)\n?\}\s*(?=@|$)/g)) {
    if (/^(comment|string|preamble)$/i.test(m[1]!)) continue;
    const f: Record<string, string> = {};
    for (const k of m[2]!.matchAll(/(\w+)\s*=\s*(?:\{((?:[^{}]|\{[^{}]*\})*)\}|"([^"]*)"|(\d+))/g)) {
      f[k[1]!.toLowerCase()] = (k[2] ?? k[3] ?? k[4] ?? '').replace(/[{}]/g, '').replace(/\s+/g, ' ').trim();
    }
    const ref: RawReference = { raw: m[0].trim() };
    if (f.title) ref.title = f.title;
    if (f.author) ref.authors = f.author.split(/\s+and\s+/i).map((a) => (a.includes(',') ? a.split(',')[0]! : a.split(' ').pop()!).trim());
    const yr = Number((f.year ?? f.date ?? '').slice(0, 4));
    if (yr) ref.year = yr;
    if (f.doi) ref.doi = findDoi(f.doi) ?? f.doi.toLowerCase();
    if (f.journal ?? f.booktitle) ref.container = f.journal ?? f.booktitle;
    if (f.url) ref.url = f.url;
    if (f.isbn) ref.isbn = f.isbn;
    out.push(ref);
  }
  return out;
}

export function parseRis(text: string): RawReference[] {
  const out: RawReference[] = [];
  for (const block of text.split(/^ER\s{2}-.*$/m)) {
    const tag = (t: string) => [...block.matchAll(new RegExp(`^${t}\\s{2}-\\s*(.+)$`, 'gm'))].map((m) => m[1]!.trim());
    const title = tag('TI')[0] ?? tag('T1')[0];
    if (!title) continue;
    const ref: RawReference = { raw: block.trim(), title };
    const authors = [...tag('AU'), ...tag('A1')].map((a) => a.split(',')[0]!.trim());
    if (authors.length) ref.authors = authors;
    const yr = Number((tag('PY')[0] ?? tag('Y1')[0] ?? '').slice(0, 4));
    if (yr) ref.year = yr;
    const doi = tag('DO')[0];
    if (doi) ref.doi = findDoi(doi) ?? doi.toLowerCase();
    const jo = tag('JO')[0] ?? tag('T2')[0] ?? tag('JF')[0];
    if (jo) ref.container = jo;
    out.push(ref);
  }
  return out;
}

const BARE_DOI = /^(?:https?:\/\/(?:dx\.)?doi\.org\/|doi:\s*)?10\.\d{4,9}\/\S+$/i;

const looksLikeReference =(l: string): boolean => {
  const n = tokens(l).length;
  if (n < 5 || l.length > 900) return false;
  if (findDoi(l) || arxivDoi(l)) return true;
  const bare = l.replace(NUMBERED, '');
  if (/\b(?:1[5-9]|20)\d{2}\b/.test(l) && (VANCOUVER.test(bare) || NATURE.test(bare))) return true;
  if (NUMBERED.test(l) && (YEAR_PAREN.test(l) || QUOTED_TITLE.test(l))) return true;
  return /^[\p{Lu}\p{L}][^()]{1,260}\((?:\d{4})[a-z]?(?:,[^)]*)?\)\.?\s+\S/u.test(l) && /[.,]/.test(l.slice(0, l.indexOf('(')));
};

/** Joins references that were wrapped over several lines in a PDF or email. */
function unwrap(text: string): string[] {
  const blocks = text.replace(/\r/g, '').split(/\n\s*\n/);
  const out: string[] = [];
  for (const b of blocks) {
    const lines = b.split('\n').map((l) => l.trim()).filter(Boolean);
    let cur = '';
    for (const l of lines) {
      if (BARE_DOI.test(l)) {
        // A DOI on its own line finishes the reference above it, unless that one already has a DOI.
        if (cur && !findDoi(cur) && looksLikeReference(cur)) cur = `${cur} ${l}`;
        else {
          if (cur) out.push(cur);
          cur = l;
        }
        continue;
      }
      if (cur && BARE_DOI.test(cur)) {
        out.push(cur);
        cur = '';
      }
      // A web page line (words, then an address) starts a new entry when the one above is already complete:
      // it ends in page numbers, a DOI or an address. An address alone on a line still belongs to the entry above.
      const webStart = !!cur && /\bhttps?:\/\//i.test(l) && tokens(l.replace(/https?:\/\/\S+/gi, ' ')).length >= 2 && /(\d[\d–-]*\.?|https?:\/\/\S+|\b10\.\d{4,9}\/\S+)\s*$/.test(cur) && looksLikeReference(cur);
      const starts = looksLikeReference(l) || NUMBERED.test(l) || /^[\p{Lu}][\p{L}’'\-]+,\s+\p{Lu}\./u.test(l) || webStart;
      if (starts && cur) {
        out.push(cur);
        cur = l;
      } else cur = cur ? `${cur} ${l}` : l;
    }
    if (cur) out.push(cur);
  }
  return out;
}

export interface Extracted {
  references: RawReference[];
  /** In-text citations such as "(Noy & Zhang, 2023)" that have no matching entry in the list. */
  orphanCitations: string[];
}

export function extractReferences(text: string): Extracted {
  const t = text.trim();
  if (!t) return { references: [], orphanCitations: [] };
  if (/^\s*@\w+\s*\{/m.test(t)) return { references: parseBibtex(t), orphanCitations: [] };
  if (/^TY\s{2}-/m.test(t)) return { references: parseRis(t), orphanCitations: [] };

  const parts = unwrap(t);
  const refs: RawReference[] = [];
  const prose: string[] = [];
  for (const p of parts) {
    if (BARE_DOI.test(p)) refs.push({ raw: p, doi: findDoi(p)! });
    else if (looksLikeReference(p)) refs.push(parseReference(p));
    // A short line with a web address is a reference to a web page, even with no author, year or DOI.
    else if (/\bhttps?:\/\/\S+/i.test(p) && tokens(p).length <= 40) refs.push(parseReference(p));
    else prose.push(p);
  }
  if (!refs.length && parts.length === 1 && tokens(t).length >= 4 && tokens(t).length <= 40 && !/\(\p{L}[^)]*,\s*\d{4}[a-z]?\)/u.test(t)) {
    const r = parseReference(t);
    refs.push(r.title && r.authors?.length ? r : { raw: t, title: t, ...(findDoi(t) ? { doi: findDoi(t)! } : {}) });
  }
  const seen = new Set(refs.map((r) => r.doi).filter(Boolean));
  for (const p of prose) {
    for (const m of p.matchAll(/\b10\.\d{4,9}\/[^\s"<>\]}]+/gi)) {
      const d = findDoi(m[0])!;
      if (!seen.has(d)) {
        seen.add(d);
        refs.push({ raw: d, doi: d });
      }
    }
  }
  const orphans = new Set<string>();
  for (const p of prose) {
    for (const m of p.matchAll(/\(([^()]*?\b(?:1[89]|20)\d{2}[a-z]?)\)/g)) {
      for (const c of m[1]!.split(';')) {
        const y = Number(c.match(/\b((?:1[89]|20)\d{2})/)?.[1]);
        const fam = c.trim().match(/^(?:see |e\.g\.,? |cf\. )?([\p{Lu}][\p{L}’'\-]+)/u)?.[1];
        if (!fam || !y) continue;
        const hit = refs.some((r) => r.raw.toLowerCase().includes(fam.toLowerCase()) && (r.year === undefined || Math.abs(r.year - y) <= 1));
        if (!hit) orphans.add(c.trim());
      }
    }
  }
  return { references: refs, orphanCitations: [...orphans] };
}
