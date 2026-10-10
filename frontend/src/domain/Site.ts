import type { SiteCommunity } from './Community';
import type { PhotoFlags } from './PhotoFlag';
// Mirrors contracts/schemas/site.schema.json; change the contract first.
import type { ReportType } from './ReportType';
import type { SiteInsights } from './SiteInsights';

export type SiteContext =
  | 'vacant_plot'
  | 'roadside'
  | 'drain'
  | 'other'
  | 'no_bin'
  | 'no_pickup'
  | 'stagnant'
  | 'sewage'
  | 'foam'
  | 'choked_drain'
  | 'uncovered_debris'
  | 'dusty_site'
  | 'overflowing'
  | 'damaged';

/**
 * removed: every report on an unverified site was withdrawn (decision 20261010-1700).
 * expired: no report, vote or after-photo for 90 days (decision 20261010-1855).
 * GET /sites?bbox leaves out cleaned, removed and expired sites.
 */
export type SiteStatus = 'open' | 'cleaned' | 'reopened' | 'removed' | 'expired';

/** Decision 20261010-1530: unverified until 10 people back it. GET /sites?bbox leaves out rejected sites. */
export type SiteVerification = 'unverified' | 'verified' | 'rejected';

/** People backing a site by photo or yes vote, each counted once. */
export interface SiteBackers {
  readonly count: number;
  readonly needed: number;
  readonly photo_people: number;
  readonly vote_people: number;
}

/** pending_confirmation: the after-photo passed but fewer than 3 people say cleared (decision 20261010-1855). Resets to none when the site reopens. */
export type CleanupStatus = 'none' | 'checking' | 'pending_confirmation' | 'accepted' | 'rejected';

/** People saying cleared since the newest photo, by after-photo or cleared vote, each once; needed is at least 3. */
export interface SiteClearance {
  readonly count: number;
  readonly needed: number;
  readonly still_there: number;
}

export interface AreaRef {
  readonly id: string;
  readonly name: string;
}

export interface LocalBody {
  readonly id: string;
  readonly name: string;
  readonly head_office: string;
}

/** Offices only: never a name or a party. */
export interface Representative {
  readonly office: 'councillor' | 'mla' | 'mp';
  readonly seat_id: string;
  readonly as_of: string;
  readonly source: string;
}

/** outdated: the loaded boundary predates a re-delimitation; letters never Cc that MP. */
export type SeatStatus = 'current' | 'outdated' | null;

export interface LoksabhaRef extends AreaRef {
  readonly status?: SeatStatus;
}

export interface SiteLocation {
  readonly state: string;
  readonly district: AreaRef;
  readonly town: string | null;
  readonly local_body: LocalBody | null;
  readonly ward: AreaRef | null;
  /** Null outside Rajasthan, where no assembly boundaries are loaded yet. */
  readonly assembly_seat: AreaRef | null;
  readonly loksabha_seat: LoksabhaRef;
  readonly representatives: readonly Representative[];
}

export interface BrandSighting {
  readonly brand: string;
  readonly parent_company: string;
  readonly confidence: number;
  readonly source_url: string;
}

export interface SiteVotes {
  readonly confirm: number;
  readonly reject: number;
  /** People whose latest vote says the site is cleared; absent on older rows. */
  readonly cleaned?: number;
}

export interface SiteProperties {
  readonly site_id: string;
  readonly report_type: ReportType;
  readonly context: SiteContext;
  readonly status: SiteStatus;
  readonly verification: SiteVerification;
  readonly report_count: number;
  readonly verified_count: number;
  readonly corroborations: number;
  readonly backers: SiteBackers;
  /** Decision 20261010-1630: present on no_bin sites, which are no-bin zones of this radius. */
  readonly zone_radius_m?: number;
  readonly votes: SiteVotes;
  readonly photo_urls: readonly string[];
  /** v1.15: photos residents reported; warned ones show behind a tap, hidden ones have left photo_urls. */
  readonly photo_flags?: readonly PhotoFlags[];
  readonly cleanup_status: CleanupStatus;
  readonly cleanup_photo_url: string | null;
  readonly burning: boolean;
  readonly location: SiteLocation;
  readonly brands: readonly BrandSighting[];
  readonly first_reported_at: string;
  readonly last_reported_at: string;
  readonly cleaned_at: string | null;
  /** Progress towards cleaned; absent before the first cleared word (decision 20261010-1855). */
  readonly clearance?: SiteClearance;
  /** 90 days after the last report, vote or after-photo; absent on older rows. */
  readonly expires_at?: string;
  /** What set the last cleaned status; absent on older rows. */
  readonly cleaned_by?: 'after_photo' | 'votes' | null;
  /** Why a removed site left the map, and when; absent on older rows. */
  readonly removed_reason?: 'withdrawn' | 'photos_reported' | null;
  readonly removed_at?: string | null;
  readonly pilot: boolean;
  /** v1.4: distinct people who reported the site (user id, else device); absent on older rows. */
  readonly reporters?: number;
  /** Optional in v1.1 so older producers stay valid; the worker always writes it. */
  readonly insights?: SiteInsights;
  /** v1.8: what residents' moderated notes say; absent until the first note is accepted. */
  readonly community?: SiteCommunity | null;
}

export type LonLat = readonly [lon: number, lat: number];

export interface SiteFeature {
  readonly type: 'Feature';
  readonly geometry: { readonly type: 'Point'; readonly coordinates: LonLat };
  readonly properties: SiteProperties;
}

/** GET /sites?bbox response. */
export interface SiteCollection {
  readonly type: 'FeatureCollection';
  readonly features: readonly SiteFeature[];
}
