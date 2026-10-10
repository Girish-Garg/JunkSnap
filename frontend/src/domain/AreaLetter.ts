import type { SignalFlag } from './Community';
// Mirrors contracts/schemas/area_letter_draft.schema.json (v1.6, decision 20261010-1600) and POST /areas/{kind}/{id}/letters.
import type { AreaKind, ScoreName } from './AreaScores';
import type { ReportType } from './ReportType';
import type { SiteStatus } from './Site';
import type { LetterAddressee, LetterCc, LetterCitation, LetterEvidence, LetterLanguage } from './SiteActions';

export const AREA_ISSUES = ['waste_dump', 'no_bin', 'contaminated_water', 'open_construction', 'overflowing_bin', 'all'] as const;

/** One report type, or every type at once. */
export type AreaIssue = ReportType | 'all';

export interface AreaLetterRequest {
  readonly issue: AreaIssue;
  readonly language: LetterLanguage;
  readonly device_token: string;
}

/** One of up to 5 worst verified sites: counts, dates, blurred photos and measured insights. */
export interface AreaLetterSite {
  readonly site_id: string;
  readonly report_type: ReportType;
  readonly context: string;
  readonly status: SiteStatus;
  readonly report_count: number;
  readonly verified_count: number;
  readonly first_reported_at: string;
  readonly last_reported_at: string;
  /** Blurred public copies only. */
  readonly photo_urls: readonly string[];
  readonly insights: LetterEvidence['insights'];
}

/** A measured area score; withheld scores are left out by the api. */
export interface AreaLetterScore {
  readonly name: ScoreName;
  readonly value: number;
  readonly verified_reports: number;
}

/** What an area letter rests on: the issue's counts in the area, its worst sites, the measured scores and bin access. */
export interface AreaLetterEvidence {
  readonly reports: number;
  readonly reporters: number | null;
  readonly verified_reports: number;
  readonly sites: number;
  readonly first_reported_at: string;
  readonly last_reported_at: string;
  readonly worst_sites: readonly AreaLetterSite[];
  readonly scores: readonly AreaLetterScore[];
  /** For waste_dump, no_bin and all; null for other issues. */
  readonly bin_access: { readonly sites_measured: number; readonly sites_without_bin_within_3km: number } | null;
  /** v1.8: sites with residents' notes, the people behind them and how many sites mention each signal. */
  readonly residents?: { readonly sites: number; readonly people: number; readonly mentions: readonly { readonly signal: SignalFlag; readonly sites: number }[] } | null;
}

/** The same letter as a site letter, about one issue in an area; `to` lists every office responsible. */
export interface AreaLetterDraft {
  readonly letter_id: string;
  readonly area: { readonly kind: AreaKind; readonly id: string; readonly name: string };
  readonly issue: AreaIssue;
  readonly to: readonly LetterAddressee[];
  readonly cc: readonly LetterCc[];
  readonly subject: string;
  readonly body: string;
  readonly language: LetterLanguage;
  readonly citations: readonly LetterCitation[];
  readonly verifier: { readonly verified: number; readonly total: number };
  readonly template_fallback: boolean;
  readonly provider: string;
  readonly model: string;
  readonly version: string;
  readonly created_at: string;
  readonly evidence: AreaLetterEvidence;
}
