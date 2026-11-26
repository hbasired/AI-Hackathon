// @vitest-environment node
import { describe, expect, it } from 'vitest';
import type { RegistryRecord } from '@/core/contracts';
import { extractReferences } from '@/core/verify/parse';
import { registryFix } from '@/core/verify/fix';
import { checkReference, firstPageGiven, sameSlot, type Registries } from '@/core/verify/verdict';

/**
 * Old and translated papers: a student cites the English title, the registries hold the original-language one.
 * The records below are SAMPLE stand-ins under the 10.5555 example prefix, not real papers.
 */
const original = (o: Partial<RegistryRecord> = {}): RegistryRecord => ({ registry: 'crossref', id: '10.5555/orig.1', doi: '10.5555/orig.1', title: 'Über die Bewegung kleiner Teilchen im Wasser', authors: [{ family: 'Brandt' }], year: 1907, container: 'Annalen der Beispiele', volume: '22', pages: '549-560', retracted: false, ...o });
const reprint = original({ id: '10.5555/reprint.9', doi: '10.5555/reprint.9', title: 'On the movement of small particles in water', year: 1970, pages: '75-91', container: 'Collected Papers' });
const reg = (o: { byDoi?: RegistryRecord | null; search?: RegistryRecord[]; slot?: RegistryRecord[] }): Registries => ({
  crossrefByDoi: async () => o.byDoi ?? null,
  openalexByDoi: async (doi) => (o.byDoi?.doi === doi ? { ...o.byDoi, registry: 'openalex' } : (o.slot ?? []).find((r) => r.doi === doi) ? { ...(o.slot ?? []).find((r) => r.doi === doi)!, registry: 'openalex' } : null),
  dataciteByDoi: async () => null,
  doiExists: async () => false,
  crossrefSearch: async () => o.search ?? [],
  crossrefByAuthorYear: async () => o.slot ?? [],
  openalexSearch: async () => [],
});
const ref = (line: string) => extractReferences(line).references[0]!;
const EN = 'Brandt, K. (1907). On the movement of small particles in water. Annalen der Beispiele, 22, 549–560.';

describe('titles with abbreviations', () => {
  it('a full stop after Mr., Dr., St. or vs. does not end the title', () => {
    expect(ref('Brandt, K. (1672). A letter of Mr. Isaac Brandt containing his new theory about light. Transactions of Examples, 6, 3075–3087.')).toMatchObject({ title: 'A letter of Mr. Isaac Brandt containing his new theory about light', container: 'Transactions of Examples', year: 1672 });
    expect(ref('Brandt, K. (1990). Dr. Jekyll and the double life of samples. Journal of Examples, 4, 1–9.').title).toBe('Dr. Jekyll and the double life of samples');
    expect(ref('Brandt, K. (1990). Brown vs. Board revisited. Journal of Examples, 4, 1–9.').title).toBe('Brown vs. Board revisited');
    expect(ref('Brandt, K. (2001). A short title. Journal of Examples, 4, 1–9.').title).toBe('A short title');
  });
});

describe('the first page a student gave', () => {
  it('reads common styles and ignores DOIs and year ranges', () => {
    expect(firstPageGiven(ref('Brandt, K. (1907). A title here. Annalen, 22, 549–560.'))).toBe('549');
    expect(firstPageGiven(ref('Brandt K. A title here. Annalen 1907;22:549-60.'))).toBe('549');
    expect(firstPageGiven(ref('Brandt, K. (1907). A title here. Annalen, 22, pp. 549-560. https://doi.org/10.5555/123-456'))).toBe('549');
    expect(firstPageGiven(ref('Brandt, K. (2014–2015). A title here. Annalen.'))).toBeUndefined();
  });
  it('the same slot needs first author, year and first page', () => {
    expect(sameSlot(ref(EN), original())).toBe(true);
    expect(sameSlot(ref(EN), original({ pages: '132-148' }))).toBe(false);
    // One year either way (old calendar dates, online-first years); two years is another slot.
    expect(sameSlot(ref(EN), original({ year: 1908 }))).toBe(true);
    expect(sameSlot(ref(EN), original({ year: 1909 }))).toBe(false);
    expect(sameSlot(ref(EN), original({ authors: [{ family: 'Other' }] }))).toBe(false);
  });
});

describe('a translated title', () => {
  it('with the DOI: Details differ, may be a translation, never Wrong paper, and the original title is offered', async () => {
    const r = ref(`${EN} https://doi.org/10.5555/orig.1`);
    const c = await checkReference(r, reg({ byDoi: original() }));
    expect(c.verdict).toBe('details-differ');
    expect(c.reasons[0]).toBe('TITLE_MAY_BE_TRANSLATED');
    expect(registryFix(r, c)?.changes.map((x) => x.field)).toEqual(['title']);
  });
  it('with the DOI of another paper by the same author that year: still Wrong paper (the pages differ)', async () => {
    const c = await checkReference(ref(`${EN} https://doi.org/10.5555/orig.2`), reg({ byDoi: original({ id: '10.5555/orig.2', doi: '10.5555/orig.2', title: 'Eine ganz andere Arbeit über Licht', pages: '132-148' }) }));
    expect(c.verdict).toBe('wrong-paper');
  });
  it('without a DOI: a later reprint is not offered as a year fix; the original is found by author, year and first page', async () => {
    const c = await checkReference(ref(EN), reg({ search: [reprint], slot: [original(), original({ id: '10.5555/orig.2', doi: '10.5555/orig.2', title: 'Eine ganz andere Arbeit', pages: '132-148' })] }));
    expect(c.verdict).toBe('details-differ');
    expect(c.reasons[0]).toBe('TITLE_MAY_BE_TRANSLATED');
    expect(c.record?.doi).toBe('10.5555/orig.1');
    expect(c.record?.year).toBe(1907);
  });
  it('two works in the same slot: nothing is guessed', async () => {
    const c = await checkReference(ref(EN), reg({ search: [], slot: [original(), original({ id: '10.5555/orig.3', doi: '10.5555/orig.3', title: 'Noch eine Arbeit' })] }));
    expect(c.record?.doi).not.toBe('10.5555/orig.1');
    expect(c.verdict).not.toBe('confirmed');
  });
  it('only a later reprint found: Details differ (LATER_REPRINT), and no year fix is offered', async () => {
    const r = ref('Brandt, K. (1907). On the movement of small particles in water. Annalen der Beispiele, 22, 549–560.');
    const c = await checkReference(r, reg({ search: [reprint], slot: [] }));
    expect(c.verdict).toBe('details-differ');
    expect(c.reasons).toContain('LATER_REPRINT');
    expect(c.reasons).not.toContain('YEAR_DIFFERS');
    expect(registryFix(r, c)).toBeNull();
  });
  it('a retracted original stays Retracted', async () => {
    const c = await checkReference(ref(`${EN} https://doi.org/10.5555/orig.1`), reg({ byDoi: original({ retracted: true }) }));
    expect(c.verdict).toBe('retracted');
  });
});
