/**
 * The contract between everyone's work. Change it only through Yash.
 * Rule of the product: AI may propose, code confirms, the student decides.
 */

/** What the assessment allows. Enforced at the server as well as in the UI. */
export type AiLevel = 0 | 1 | 2 | 3;

export type RegistryName = 'crossref' | 'openalex' | 'datacite' | 'doi.org' | 'retraction-watch';

/** Verdict on whether a reference is real. Only code in core/verify may create one. */
export type Verdict = 'confirmed' | 'one-registry' | 'details-differ' | 'wrong-paper' | 'retracted' | 'not-found' | 'could-not-check';

/** Label on a claim. Only code in core/claims may create one. */
export type ClaimLabel = 'verified' | 'reported' | 'ai-reasoning' | 'disputed' | 'not-found';

/** Closed list. Every verdict or label that is not a clean pass carries at least one. */
export type ReasonCode =
  | 'DOI_DOES_NOT_EXIST'
  | 'DOI_IS_ANOTHER_PAPER'
  | 'TITLE_DIFFERS'
  | 'AUTHOR_DIFFERS'
  | 'YEAR_DIFFERS'
  | 'AUTHORS_NOT_LISTED'
  | 'NO_MATCH_IN_REGISTRIES'
  | 'RETRACTED'
  | 'REGISTRY_UNREACHABLE'
  | 'SECOND_REGISTRY_UNREACHABLE'
  | 'SECOND_REGISTRY_NO_RECORD'
  | 'NO_DOI_ONE_REGISTRY'
  | 'WEB_SOURCE'
  | 'TITLE_ONLY'
  | 'TITLE_MAY_BE_TRANSLATED'
  | 'LATER_REPRINT'
  | 'REGISTRY_METADATA_DISAGREES'
  | 'NOT_ENOUGH_TO_SEARCH'
  | 'QUOTE_NOT_IN_SOURCE'
  | 'NUMBER_MISMATCH'
  | 'DIRECTION_FLIPPED'
  | 'SCOPE_OVERCLAIM'
  | 'NO_SOURCE'
  | 'NO_READABLE_TEXT'
  | 'MODEL_UNSURE'
  | 'MEANING_NOT_COMPARED'
  | 'CONTRADICTED_BY_SOURCE'
  | 'INSTRUCTION_IN_SOURCE';

/** A reference as the student (or an AI tool) wrote it. Nothing here is trusted. */
export interface RawReference {
  raw: string;
  doi?: string;
  title?: string;
  authors?: string[];
  year?: number;
  container?: string;
  url?: string;
  isbn?: string;
}

export interface Author {
  family: string;
  given?: string;
}

/** Something the journal or Retraction Watch published about a work after it came out. Read from Crossref. */
export interface Notice {
  kind: 'retraction' | 'concern' | 'correction';
  label: string;
  on?: string;
  /** DOI of the notice itself. */
  doi?: string;
  by: 'publisher' | 'retraction-watch';
  /** Why, in Retraction Watch's own words (its controlled list). Only from the Retraction Watch index. */
  reasons?: string[];
}

/** A record that came from a registry. The only thing a citation may be built from. */
export interface RegistryRecord {
  registry: RegistryName;
  id: string;
  doi?: string;
  title: string;
  authors: Author[];
  year?: number;
  /** Year of the printed issue. A paper online in 2014 and in a 2015 issue is cited as 2015. */
  printYear?: number;
  container?: string;
  volume?: string;
  issue?: string;
  pages?: string;
  publisher?: string;
  type?: string;
  url?: string;
  abstract?: string;
  openAccessUrl?: string;
  citedBy?: number;
  references?: string[];
  openalexId?: string;
  retracted: boolean;
  retractedOn?: string;
  notices?: Notice[];
  /** DOIs the publisher says are another version of this work, for example its preprint. */
  versions?: string[];
}

export interface FieldDiff {
  field: 'title' | 'authors' | 'year' | 'doi';
  given: string;
  registry: string;
  score: number;
  ok: boolean;
}

export interface RegistryTrace {
  registry: RegistryName;
  status: 'match' | 'no-match' | 'not-found' | 'error' | 'skipped';
  note?: string;
  ms: number;
}

export interface ReferenceCheck {
  verdict: Verdict;
  reasons: ReasonCode[];
  record?: RegistryRecord;
  fields: FieldDiff[];
  trace: RegistryTrace[];
  checkedAt: string;
  /** True when this result was recorded earlier and is being replayed. The UI must show SAMPLE. */
  sample?: boolean;
}

/** Three-key rule. A source is exportable only when all three are set. */
export interface Keys {
  found: boolean;
  checked: boolean;
  approved: boolean;
}

export type CitationStyle = 'apa' | 'harvard' | 'mla' | 'chicago' | 'ieee';

export interface Project {
  id: string;
  question: string;
  style: CitationStyle;
  aiLevel: AiLevel;
  createdAt: string;
  /** Gate 1. Set when the student approves the search plan. */
  plan?: SearchPlan;
  /** Pairs of source ids the student said are different works. */
  notTheSame?: string[];
}

export interface SearchPlan {
  queries: string[];
  fromYear?: number;
  approvedAt?: string;
}

export type SourceOrigin = 'search' | 'doi' | 'bibtex' | 'ris' | 'pdf' | 'web' | 'check' | 'manual';

export interface Source {
  id: string;
  projectId: string;
  origin: SourceOrigin;
  record?: RegistryRecord;
  raw?: RawReference;
  check?: ReferenceCheck;
  keys: Keys;
  folder?: string;
  tags: string[];
  notes: string;
  /** The title with its capitals corrected by the student. Only letter case may differ from the registry. */
  citeTitle?: string;
  /** Plain text we are allowed to read: abstract, open full text, or the student's own PDF. */
  text?: string;
  textOrigin?: 'abstract' | 'fulltext' | 'pdf' | 'web';
  /** Pages in the student's PDF, so a quote can say where it is. */
  pdfPages?: number;
  /** Retracted works in this source's own reference list, and when we asked. */
  retractedRefs?: { at: string; items: { id: string; title: string; doi?: string; year?: number }[] };
  /** Set when the student keeps a flagged source. Shown on every export. */
  keptWithReason?: string;
  addedAt: string;
}

export interface Passage {
  id: string;
  sourceId: string;
  text: string;
  start: number;
  end: number;
  /** Page of the PDF, and the printed page when both agree. Missing for abstracts. */
  page?: number;
  to?: number;
  printed?: number;
  printedTo?: number;
}

export interface ClaimChecks {
  exactQuote: boolean;
  support: number | null;
  contradiction: number | null;
  /** The model's third answer: the sentence neither backs nor contradicts the claim. Older claims lack it. */
  neutral?: number | null;
  /** The claim's own words are in the source. Older claims lack it. */
  wordForWord?: boolean;
  numbers: boolean | null;
  direction: boolean | null;
  scope: boolean | null;
}

export interface Claim {
  id: string;
  projectId: string;
  text: string;
  sourceId?: string;
  passage?: Passage;
  label: ClaimLabel;
  reasons: ReasonCode[];
  checks: ClaimChecks;
  decision?: 'accepted' | 'rewritten' | 'rejected';
  keptWithReason?: string;
  /** Ranking aids at the time of saving. Shown only; they never decide the label. */
  match?: { words: number; meaning: number | null };
  by: 'student' | 'ai';
  createdAt: string;
}

export type Actor = 'student' | 'code' | 'ai';

export interface LogEvent {
  seq: number;
  projectId: string;
  at: string;
  actor: Actor;
  action: string;
  detail: string;
  model?: string;
  prompt?: string;
  prevHash: string;
  hash: string;
}

export interface Policy {
  allowedTypes: string[];
  minYear: number | null;
  peerReviewedOnly: boolean;
  blockRetracted: boolean;
  /** A work under an expression of concern needs a written reason, like a retracted one. */
  flagConcerns: boolean;
  /** Checks on the student's own draft. Rule-based, no AI. */
  draftCheck: { copied: boolean; language: boolean };
  maxAiCallsPerProject: number;
  overrideReasonMinChars: number;
  thresholds: {
    titleMatch: number;
    titlePossible: number;
    yearTolerance: number;
    supportVerified: number;
    contradiction: number;
  };
  styles: CitationStyle[];
}

/** Green only ever means proven. */
export type Tone = 'ok' | 'warn' | 'bad' | 'mute';

export interface LabelText {
  label: string;
  tone: Tone;
  mark: string;
  plain: string;
}

export const VERDICT_TEXT: Record<Verdict, LabelText> = {
  confirmed: { label: 'Confirmed', tone: 'ok', mark: '✓', plain: 'A registry has this exact work.' },
  'one-registry': { label: 'One registry only', tone: 'mute', mark: '1', plain: 'One registry has a matching work. A second matching record was not confirmed, so a retraction could be missed. Open the receipt for missing data, disagreement or an unavailable lookup, and check again before you rely on it.' },
  'details-differ': { label: 'Details differ', tone: 'warn', mark: '≠', plain: 'The work is real, but something you wrote does not match the registry.' },
  'wrong-paper': { label: 'Wrong paper', tone: 'bad', mark: '⇄', plain: 'The DOI is real and belongs to a different work.' },
  retracted: { label: 'Retracted', tone: 'bad', mark: '✕', plain: 'The publisher has withdrawn this work.' },
  'not-found': { label: 'Not found', tone: 'mute', mark: '?', plain: 'This could not be verified. None of the registries we searched has it. Some real books and regional journals are not indexed.' },
  'could-not-check': { label: 'Could not check', tone: 'mute', mark: '…', plain: 'This could not be verified. A registry did not answer, so it is neither a pass nor a fail.' },
};

export const CLAIM_TEXT: Record<ClaimLabel, LabelText> = {
  verified: { label: 'Verified', tone: 'ok', mark: '✓', plain: 'The source says this, in these words. That does not mean the source is right.' },
  reported: { label: 'Reported, not checked', tone: 'mute', mark: '~', plain: 'The source is real, but we could not confirm it says this.' },
  'ai-reasoning': { label: 'AI reasoning', tone: 'mute', mark: '⌁', plain: 'No source. Left out of exports unless you keep it with a reason.' },
  disputed: { label: 'Disputed', tone: 'warn', mark: '≠', plain: 'The cited source, or another one, says otherwise.' },
  'not-found': { label: 'Not found', tone: 'mute', mark: '?', plain: 'We searched and found nothing reliable.' },
};

export const REASON_TEXT: Record<ReasonCode, string> = {
  DOI_DOES_NOT_EXIST: 'This DOI does not exist.',
  DOI_IS_ANOTHER_PAPER: 'This DOI opens a different paper.',
  TITLE_DIFFERS: 'The title does not match the registry.',
  AUTHOR_DIFFERS: 'One or more authors do not match the registry.',
  YEAR_DIFFERS: 'The year does not match the registry.',
  AUTHORS_NOT_LISTED: 'The registry lists no authors for this work, so we could not compare them.',
  NO_MATCH_IN_REGISTRIES: 'No registry we searched has a matching work.',
  RETRACTED: 'The publisher has retracted this work.',
  REGISTRY_UNREACHABLE: 'A registry did not answer.',
  SECOND_REGISTRY_UNREACHABLE: 'The second registry did not answer.',
  SECOND_REGISTRY_NO_RECORD: 'The second registry answered but has no record for this DOI.',
  NO_DOI_ONE_REGISTRY: 'Found by title and authors in one registry, with no DOI. Many real papers have none. Check the publisher’s page before you rely on it.',
  WEB_SOURCE: 'A web page, not a scholarly work, so it was not checked in a scholarly database. Open the page and check who published it and when.',
  TITLE_ONLY: 'Only a title was given, and different works can share a title. Add the authors and year, or the DOI, and check again.',
  TITLE_MAY_BE_TRANSLATED: 'The title differs, but the first author, the year and the first page match this record. It may be the same work under a longer or original-language title, or a translation. Check it, then use the registry’s title or keep yours with a reason.',
  LATER_REPRINT: 'Only a later reprint or edition with this title was found. The original, from the year you gave, is not in the registries we searched (many older journals have no DOI). Keep your year; do not change it to the reprint’s.',
  REGISTRY_METADATA_DISAGREES: 'The registries returned different identity metadata. Review the original records.',
  NOT_ENOUGH_TO_SEARCH: 'There is not enough here to search with. Add a title or a DOI.',
  QUOTE_NOT_IN_SOURCE: 'These words are not in the source.',
  NUMBER_MISMATCH: 'A number does not match the source.',
  DIRECTION_FLIPPED: 'The source says the opposite direction.',
  SCOPE_OVERCLAIM: 'The claim goes further than the source.',
  NO_SOURCE: 'No source is attached.',
  NO_READABLE_TEXT: 'We could not read the text of this source.',
  MODEL_UNSURE: 'The support check was not sure.',
  MEANING_NOT_COMPARED: 'Not word for word, and the meaning has not been compared yet.',
  CONTRADICTED_BY_SOURCE: 'The source contradicts this.',
  INSTRUCTION_IN_SOURCE: 'The source text contains instructions aimed at an AI. They were ignored.',
};

/** The only place that decides whether a source may be cited. */
export const exportable = (s: Source): boolean => s.keys.found && s.keys.checked && s.keys.approved;
