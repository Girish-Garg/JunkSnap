import type { CommunitySignals } from './Community';
// The site action bodies in contracts/README.md (votes, cleanup, letters) and letter_draft.schema.json.
import type { GpsFix } from './ReportUpload';
import type { SiteBackers, SiteStatus, SiteVerification, SiteVotes } from './Site';

/** cleaned: the waste is gone; 3 more people saying so than still there clears the site (decision 20261010-1700). */
export type VoteChoice = 'confirm' | 'reject' | 'cleaned';

export interface VoteRequest {
  readonly device_token: string;
  readonly vote: VoteChoice;
  readonly gps: GpsFix;
}

export interface VoteResult {
  readonly site_id: string;
  readonly votes: SiteVotes;
  readonly backers: SiteBackers;
  readonly verification: SiteVerification;
}

/** DELETE /sites/{id}/reports/mine: site_removed when the caller was its only reporter. */
export interface WithdrawalResult {
  readonly site_id: string;
  readonly withdrawn_report_ids: readonly string[];
  readonly site_removed: boolean;
  readonly status: SiteStatus;
  readonly verification: SiteVerification;
  readonly backers: SiteBackers;
}

/** Sent after the after-photo was PUT with a purpose: cleanup presign. */
export interface CleanupRequest {
  readonly upload_id: string;
  readonly device_token: string;
  readonly sha256: string;
  readonly gps: GpsFix;
  readonly captured_at: string;
}

export interface CleanupAccepted {
  readonly cleanup_id: string;
  readonly site_id: string;
  readonly status: 'checking';
}

export type LetterLanguage = 'en' | 'hi';

export interface LetterRequest {
  readonly device_token: string;
  readonly channel: 'local_body';
  readonly language: LetterLanguage;
}

export interface LetterCitation {
  readonly rule_id: string;
  readonly document: string;
  readonly clause: string;
  readonly quote: string;
  /** SHA-256 of the official PDF the rule comes from. */
  readonly source_sha256: string;
  readonly verified: true;
}

/** Offices and seats only: never a person's name. */
export interface LetterCc {
  readonly office: 'councillor' | 'mla' | 'mp';
  readonly seat: { readonly id: string; readonly name: string };
  readonly marking: 'for attention';
}

export interface LetterDraft {
  readonly letter_id: string;
  readonly site_id: string;
  readonly channel: string;
  readonly to: LetterAddressee;
  readonly cc: readonly LetterCc[];
  readonly subject: string;
  readonly body: string;
  readonly language: LetterLanguage;
  readonly citations: readonly LetterCitation[];
  readonly verifier: { readonly verified: number; readonly total: number };
  readonly template_fallback: boolean;
  readonly filing_url: string | null;
  readonly provider: string;
  readonly model: string;
  readonly version: string;
  readonly created_at: string;
  /** v1.4: what the letter rests on, shown and printed with it; absent from older servers. */
  readonly evidence?: LetterEvidence;
}

/** letter_draft.evidence: counts, dates, blurred photos and the measured insights. */
export interface LetterEvidence {
  readonly report_count: number;
  readonly reporters: number | null;
  readonly verified_count: number;
  readonly first_reported_at: string;
  readonly last_reported_at: string;
  /** Blurred public copies only. */
  readonly photo_urls: readonly string[];
  readonly insights: {
    readonly reports: number;
    readonly composition: readonly { readonly material: string; readonly share_pct: number; readonly reports: number }[];
    readonly size_class: 'small' | 'medium' | 'large' | null;
    readonly hazards: readonly string[];
    readonly near: readonly { readonly kind: 'school' | 'hospital' | 'water' | 'drain'; readonly distance_m: number }[];
  } | null;
  readonly nearest_bin: { readonly distance_m: number; readonly ref: string; readonly source_url: string } | null;
  readonly no_bin_within_3km: boolean | null;
  /** v1.8: what residents' notes say, as signals; never a note's own words. */
  readonly residents?: { readonly people: number; readonly signals: CommunitySignals } | null;
}

/** An office the letter is addressed to, never a person. */
export interface LetterAddressee {
  readonly office: string;
  readonly body: string;
}

/** What every letter view needs, for a site letter (one addressee) or an area letter (every office responsible). */
export type LetterBase = Omit<LetterDraft, 'site_id' | 'evidence' | 'to' | 'channel' | 'filing_url'> & {
  readonly to: LetterAddressee | readonly LetterAddressee[];
  readonly filing_url?: string | null;
};
