import type { AreaRef } from "./AreaKey.js";
import type { GeoPoint } from "./GeoPoint.js";
import type { BrandSighting, CompositionEstimate, PlaceKind, SiteInsights } from "./SiteInsights.js";
import { DAY_MS, istParts } from "./scoreUtils.js";
import { isLapsedAt } from "./SiteExpiry.js";

export const REPORT_TYPES = ["waste_dump", "no_bin", "contaminated_water", "open_construction", "overflowing_bin"] as const;
export const SITE_STATUSES = ["open", "cleaned", "reopened", "removed", "expired"] as const;
export const VERIFICATIONS = ["unverified", "verified", "rejected"] as const;

export type ReportType = (typeof REPORT_TYPES)[number];
export type SiteStatus = (typeof SITE_STATUSES)[number];
export type Verification = (typeof VERIFICATIONS)[number];

const READABLE_BRAND_CONFIDENCE = 0.8;

export interface AreaSiteProps {
  readonly siteId: string;
  readonly reportType: ReportType;
  readonly context: string;
  readonly status: SiteStatus;
  readonly verification: Verification;
  readonly verifiedCount: number;
  readonly firstReportedAt: string;
  readonly cleanedAt: string | null;
  // Decision 20261010-1855: site.expires_at, or 90 days after last_reported_at on older rows.
  readonly expiresAt: string;
  readonly pilot: boolean;
  readonly burning: boolean;
  readonly point: GeoPoint;
  readonly localBodyId: string | null;
  readonly areas: readonly AreaRef[];
  readonly brands: readonly BrandSighting[];
  readonly insights: SiteInsights | null;
  // captured_at of the site's verified reports, epoch ms.
  readonly reportTimes: readonly number[];
}

export class AreaSite {
  readonly #props: AreaSiteProps;

  constructor(props: AreaSiteProps) {
    this.#props = props;
  }

  get id(): string {
    return this.#props.siteId;
  }

  get areas(): readonly AreaRef[] {
    return this.#props.areas;
  }

  get firstReportedAt(): string {
    return this.#props.firstReportedAt;
  }

  get localBodyId(): string | null {
    return this.#props.localBodyId;
  }

  // The district and local body that hold the site, for the city list's within filter.
  within(): string[] {
    const districts = this.#props.areas.filter((area) => area.kind === "district").map((area) => area.id);
    return this.#props.localBodyId === null ? districts : [...districts, this.#props.localBodyId];
  }

  withReportTimes(reportTimes: readonly number[]): AreaSite {
    return new AreaSite({ ...this.#props, reportTimes });
  }

  // Rejected, removed (every report withdrawn, decision 20261010-1700) and expired (decision 20261010-1855) sites never count.
  isCounted(): boolean {
    const { verification, status } = this.#props;
    return verification !== "rejected" && status !== "removed" && status !== "expired";
  }

  // An open or reopened site past its expiry that the CronJob should mark expired.
  isLapsedAt(now: Date): boolean {
    const { status, verification, expiresAt } = this.#props;
    return status !== "expired" && isLapsedAt(status, verification, expiresAt, now);
  }

  expired(): AreaSite {
    return new AreaSite({ ...this.#props, status: "expired" });
  }

  isVerified(): boolean {
    return this.#props.verification === "verified";
  }

  isPilot(): boolean {
    return this.#props.pilot;
  }

  hasStatus(status: SiteStatus): boolean {
    return this.#props.status === status;
  }

  isType(reportType: ReportType): boolean {
    return this.#props.reportType === reportType;
  }

  inContext(contexts: ReadonlySet<string>): boolean {
    return contexts.has(this.#props.context);
  }

  verifiedReports(): number {
    return this.#props.verifiedCount;
  }

  reportTimes(): readonly number[] {
    return this.#props.reportTimes;
  }

  // Open sites count the days open so far; a reopened site keeps the days its last cleanup took.
  daysToClear(nowMs: number): number {
    const end = this.#cleanedMs() ?? nowMs;
    return Math.max(0, end - this.#firstMs()) / DAY_MS;
  }

  reportedBy(epochMs: number): boolean {
    return this.#firstMs() <= epochMs;
  }

  clearedWithinDays(days: number): boolean {
    const cleaned = this.#cleanedMs();
    return cleaned !== null && cleaned - this.#firstMs() <= days * DAY_MS;
  }

  everCleared(): boolean {
    return this.#props.cleanedAt !== null || this.#props.status === "cleaned" || this.#props.status === "reopened";
  }

  isRepeatSpot(): boolean {
    const days = new Set(this.#props.reportTimes.map((time) => istParts(time).day));
    return this.#props.status === "reopened" || days.size >= 2;
  }

  distanceTo(point: GeoPoint): number {
    return this.#props.point.distanceTo(point);
  }

  hasInsights(): boolean {
    return this.#props.insights !== null;
  }

  hasHazard(): boolean {
    return this.#props.burning || (this.#props.insights?.hazards.length ?? 0) > 0;
  }

  // From site.insights, measured when the site was founded; null when not measured.
  nearestBinM(): number | null {
    return this.#props.insights?.nearest_bin?.distance_m ?? null;
  }

  binMeasured(): boolean {
    return typeof this.#props.insights?.no_bin_within_3km === "boolean";
  }

  noBinNearby(): boolean {
    return this.#props.insights?.no_bin_within_3km === true;
  }

  hasNearbyPlaces(): boolean {
    return (this.#props.insights?.near.length ?? 0) > 0;
  }

  // site.insights.near is the worker's list of places within 100 m.
  isNear(kinds: ReadonlySet<PlaceKind>): boolean {
    return (this.#props.insights?.near ?? []).some((place) => kinds.has(place.kind));
  }

  compositionEstimate(): CompositionEstimate | null {
    const insights = this.#props.insights;
    if (insights === null || insights.reports === 0 || insights.composition.length === 0) {
      return null;
    }
    return { reports: insights.reports, shares: insights.composition };
  }

  readableBrands(): readonly BrandSighting[] {
    return this.#props.brands.filter((label) => label.confidence >= READABLE_BRAND_CONFIDENCE);
  }

  #firstMs(): number {
    return Date.parse(this.#props.firstReportedAt);
  }

  #cleanedMs(): number | null {
    return this.#props.cleanedAt === null ? null : Date.parse(this.#props.cleanedAt);
  }
}
