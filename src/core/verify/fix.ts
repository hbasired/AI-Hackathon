import type { RawReference, ReferenceCheck } from '@/core/contracts';
import { tokens } from './normalise';

/**
 * A suggested fix, built only from the registry record the checker returned. Nothing is guessed: a field the
 * record does not have stays as the student wrote it. The page offers it; the student accepts or rejects it, and
 * an accepted fix is checked again, so the label still comes from checkReference().
 */
export interface Fix {
  ref: RawReference;
  /** Each detail that would change: what the student wrote, and what the registry has. */
  changes: { field: 'title' | 'authors' | 'year' | 'doi'; from: string; to: string }[];
}

export function registryFix(ref: RawReference, check: ReferenceCheck | undefined): Fix | null {
  if (!check || check.verdict !== 'details-differ' || !check.record) return null;
  // A match found by title alone may be another work: nothing is offered to fill in from it.
  if (check.reasons.includes('TITLE_ONLY') || check.reasons.includes('LATER_REPRINT')) return null;
  const r = check.record;
  const wrong = new Set(check.fields.filter((f) => !f.ok).map((f) => f.field));
  const changes: Fix['changes'] = [];
  const next: RawReference = { ...ref };
  if (wrong.has('title') && r.title) {
    changes.push({ field: 'title', from: ref.title ?? '', to: r.title });
    next.title = r.title;
  }
  if (wrong.has('authors') && r.authors.length) {
    const to = r.authors.map((a) => a.family);
    changes.push({ field: 'authors', from: (ref.authors ?? []).join(', '), to: to.join(', ') });
    next.authors = to;
  }
  if (wrong.has('year') && r.year) {
    changes.push({ field: 'year', from: ref.year ? String(ref.year) : '', to: String(r.year) });
    next.year = r.year;
  }
  if ((wrong.has('doi') || check.reasons.includes('DOI_DOES_NOT_EXIST')) && r.doi) {
    changes.push({ field: 'doi', from: ref.doi ?? '', to: r.doi });
    next.doi = r.doi;
  }
  if (!changes.length) return null;
  const names = (next.authors ?? []).join(', ');
  next.raw = [names && `${names}${next.year ? ` (${next.year})` : ''}.`, next.title && `${next.title}.`, next.container && `${next.container}.`, next.doi && `https://doi.org/${next.doi}`].filter(Boolean).join(' ');
  return { ref: next, changes };
}

/** Why two checked references are the same work, or null. Same registry DOI, or the same title, first author and year. */
export function sameWorkWhy(a: { ref: RawReference; check?: ReferenceCheck }, b: { ref: RawReference; check?: ReferenceCheck }): string | null {
  const doi = (x: typeof a) => (x.check?.record?.doi ?? x.ref.doi)?.toLowerCase();
  if (doi(a) && doi(a) === doi(b)) return `Both lead to the DOI ${doi(a)}.`;
  const title = (x: typeof a) => tokens(x.check?.record?.title ?? x.ref.title ?? '').join(' ');
  const first = (x: typeof a) => (x.check?.record?.authors[0]?.family ?? x.ref.authors?.[0] ?? '').toLowerCase();
  const year = (x: typeof a) => x.check?.record?.year ?? x.ref.year;
  if (title(a) && title(a) === title(b) && first(a) && first(a) === first(b) && year(a) && year(a) === year(b)) return 'Same title, first author and year.';
  return null;
}

/** Groups of list positions that are the same work, each group in list order. Nothing is removed here. */
export function duplicateGroups<T extends { id: number; ref: RawReference; check?: ReferenceCheck }>(items: T[]): { ids: number[]; why: string }[] {
  const out: { ids: number[]; why: string }[] = [];
  const used = new Set<number>();
  items.forEach((a, i) => {
    if (used.has(a.id)) return;
    let why = '';
    const ids = [a.id];
    for (const b of items.slice(i + 1)) {
      if (used.has(b.id)) continue;
      const w = sameWorkWhy(a, b);
      if (w) {
        ids.push(b.id);
        used.add(b.id);
        why ||= w;
      }
    }
    if (ids.length > 1) {
      used.add(a.id);
      out.push({ ids, why });
    }
  });
  return out;
}
