import type { RegistryRecord } from '@/core/contracts';
import type { Registries } from '@/core/verify/verdict';
import { getJson, RegistryError } from './http';
import { fromCrossref, fromDataCite, fromOpenAlex } from './map';
import { retractionWatch } from './retractionWatch';

const OA_FIELDS = 'id,doi,title,display_name,publication_year,authorships,primary_location,biblio,type,type_crossref,is_retracted,cited_by_count,open_access,referenced_works,abstract_inverted_index';

const doiPath = (d: string): string => d.split('/').map(encodeURIComponent).join('/');

export const registries: Registries = {
  async crossrefByDoi(doi) {
    const j = await getJson<{ message: Record<string, unknown> }>(`https://api.crossref.org/works/${doiPath(doi)}`, 'crossref');
    return j ? fromCrossref(j.message) : null;
  },
  async openalexByDoi(doi) {
    const j = await getJson<Record<string, unknown>>(`https://api.openalex.org/works/doi:${doiPath(doi)}?select=${OA_FIELDS}`, 'openalex');
    return j ? fromOpenAlex(j) : null;
  },
  async dataciteByDoi(doi) {
    const j = await getJson<{ data: Record<string, unknown> }>(`https://api.datacite.org/dois/${doiPath(doi)}`, 'other');
    return j ? fromDataCite(j.data) : null;
  },
  async doiExists(doi) {
    const j = await getJson<{ responseCode: number }>(`https://doi.org/api/handles/${doiPath(doi)}`, 'other');
    if (!j) return false;
    if (j.responseCode === 1 || j.responseCode === 200) return true;
    if (j.responseCode === 100) return false;
    throw new RegistryError(`doi.org code ${j.responseCode}`);
  },
  async crossrefSearch(query) {
    const q = encodeURIComponent(query.slice(0, 400));
    const j = await getJson<{ message: { items: Record<string, unknown>[] } }>(`https://api.crossref.org/works?rows=6&query.bibliographic=${q}`, 'crossref-search');
    return (j?.message.items ?? []).map(fromCrossref).filter((r) => r.title);
  },
  async crossrefByAuthorYear(author, year, container) {
    // One author in one year, optionally in one journal: how an old or translated paper is found without its title.
    const q = `query.author=${encodeURIComponent(author)}${container ? `&query.container-title=${encodeURIComponent(container.slice(0, 120))}` : ''}`;
    const j = await getJson<{ message: { items: Record<string, unknown>[] } }>(`https://api.crossref.org/works?rows=20&${q}&filter=from-pub-date:${year - 1},until-pub-date:${year + 1}`, 'crossref-search');
    return (j?.message.items ?? []).map(fromCrossref).filter((r) => r.title);
  },
  async openalexSearch(title) {
    // Commas separate OpenAlex filters and a colon starts a value, so neither may appear inside the title.
    const q = encodeURIComponent(title.replace(/[,:|]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 300));
    const j = await getJson<{ results: Record<string, unknown>[] }>(`https://api.openalex.org/works?per_page=6&filter=title.search:${q}&select=${OA_FIELDS}`, 'openalex-search');
    return (j?.results ?? []).map(fromOpenAlex).filter((r) => r.title);
  },
  retractionWatch: (doi) => retractionWatch.lookup(doi),
};

export interface RetractedRef { id: string; title: string; doi?: string; year?: number }

/** Retracted works in one work's own reference list, as OpenAlex holds it. One small request. */
export async function retractedReferences(openalexId: string): Promise<RetractedRef[]> {
  if (!/^W\d+$/.test(openalexId)) return [];
  const j = await getJson<{ results: Record<string, any>[] }>(`https://api.openalex.org/works?filter=cited_by:${openalexId},is_retracted:true&per-page=25&select=id,doi,title,publication_year`, 'openalex');
  return (j?.results ?? []).map((w) => {
    const r = fromOpenAlex(w);
    return { id: r.id, title: r.title, ...(r.doi ? { doi: r.doi } : {}), ...(r.year ? { year: r.year } : {}) };
  });
}

/** Full records for a handful of OpenAlex ids, in one request. */
export async function worksById(ids: string[]): Promise<RegistryRecord[]> {
  const ok = ids.filter((x) => /^W\d+$/.test(x)).slice(0, 50);
  if (!ok.length) return [];
  const j = await getJson<{ results: Record<string, unknown>[] }>(`https://api.openalex.org/works?filter=openalex:${ok.join('|')}&per-page=${ok.length}&select=${OA_FIELDS}`, 'openalex');
  return (j?.results ?? []).map(fromOpenAlex).filter((r) => r.title);
}

export interface SearchOptions {
  fromYear?: number;
  perPage?: number;
  openAccessOnly?: boolean;
}

/**
 * The Scout. OpenAlex first because it carries abstracts; Crossref when OpenAlex is out of budget.
 * Says which registry answered so the page can show it.
 */
export async function searchPapers(query: string, o: SearchOptions = {}): Promise<{ registry: 'openalex' | 'crossref'; records: RegistryRecord[]; note?: string }> {
  const n = o.perPage ?? 12;
  const filters = ['has_doi:true', 'is_retracted:false', ...(o.fromYear ? [`from_publication_date:${o.fromYear}-01-01`] : []), ...(o.openAccessOnly ? ['is_oa:true'] : [])];
  try {
    const j = await getJson<{ results: Record<string, unknown>[] }>(
      `https://api.openalex.org/works?search=${encodeURIComponent(query)}&filter=${filters.join(',')}&per-page=${n}&select=${OA_FIELDS}`,
      'openalex',
    );
    return { registry: 'openalex', records: (j?.results ?? []).map(fromOpenAlex).filter((r) => r.title) };
  } catch (e) {
    const why = e instanceof Error ? e.message : 'no answer';
    // Ask Crossref for works that carry an abstract first, because claims need text to be checked against.
    const ask = async (extra: string[]): Promise<RegistryRecord[]> => {
      const f = [...(o.fromYear ? [`from-pub-date:${o.fromYear}`] : []), ...extra];
      const j = await getJson<{ message: { items: Record<string, unknown>[] } }>(`https://api.crossref.org/works?rows=${n}&query.bibliographic=${encodeURIComponent(query)}${f.length ? `&filter=${f.join(',')}` : ''}`, 'crossref-search');
      return (j?.message.items ?? []).map(fromCrossref).filter((r) => r.title && !r.retracted);
    };
    let records = await ask(['has-abstract:true']);
    if (records.length < 4) records = [...new Map([...records, ...(await ask([]))].map((r) => [r.id, r])).values()];
    return { registry: 'crossref', records, note: `OpenAlex search did not answer (${why}), so these came from Crossref.` };
  }
}
