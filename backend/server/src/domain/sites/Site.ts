import { GeoPoint } from "./GeoPoint.js";
import type { MergeableReport } from "./MergeableReport.js";
import {
  AlreadyCleanedError,
  CleanupPendingError,
  InvalidTransitionError,
  OwnSiteError,
  TooFarError,
} from "./SiteErrors.js";
import type {
  SiteFeature,
  SiteInternals,
  SiteProperties,
  SiteState,
  Verification,
  VoteResult,
} from "./SiteTypes.js";
import { earlierTime, laterTime, mergeBrands, newestPhotos } from "./utils.js";
import type { VoteTally } from "./VoteTally.js";

export const MERGE_RADIUS_M = 40;
const VOTE_RADIUS_M = 1000;
const REPORT_PREFIX = "rpt_";

// Lifecycle: open -> cleaned (accepted after-photo only) -> reopened (an auto-verified report merges in).
export class Site {
  readonly #point: GeoPoint;
  #props: SiteProperties;
  #internals: SiteInternals;

  private constructor(state: SiteState) {
    const [lon, lat] = state.feature.geometry.coordinates;
    this.#point = new GeoPoint(lat, lon);
    this.#props = state.feature.properties;
    this.#internals = state.internals;
  }

  static restore(state: SiteState): Site {
    return new Site(state);
  }

  // The site id reuses the founding report's suffix, so a retried merge finds the same id.
  static found(report: MergeableReport): Site {
    const site = new Site({ feature: Site.#blankFeature(report), internals: Site.#blankInternals() });
    site.merge(report);
    return site;
  }

  get siteId(): string {
    return this.#props.site_id;
  }

  get verification(): Verification {
    return this.#props.verification;
  }

  get point(): GeoPoint {
    return this.#point;
  }

  get lastReportedAt(): string {
    return this.#props.last_reported_at;
  }

  get reportIds(): readonly string[] {
    return this.#internals.reportIds;
  }

  get embeddingKey(): string | null {
    return this.#internals.embeddingKey;
  }

  get version(): number {
    return this.#internals.version;
  }

  holds(reportId: string): boolean {
    return this.#internals.reportIds.includes(reportId);
  }

  isListed(): boolean {
    return this.#props.verification !== "rejected";
  }

  // Same type, within 40 m, not rejected; a cleaned site only takes an auto-verified report.
  accepts(report: MergeableReport): boolean {
    const { report_type, verification, status } = this.#props;
    if (report_type !== report.reportType || verification === "rejected") {
      return false;
    }
    if (status === "cleaned" && !report.autoVerified) {
      return false;
    }
    return this.#point.distanceTo(report.point) <= MERGE_RADIUS_M;
  }

  merge(report: MergeableReport): void {
    if (this.holds(report.reportId)) {
      return;
    }
    if (!this.accepts(report)) {
      throw new InvalidTransitionError(`${report.reportId} cannot merge into ${this.siteId}`);
    }
    this.#addReporter(report);
    this.#addEvidence(report);
    if (report.autoVerified) {
      this.#confirmByReport();
    }
    this.#recount();
  }

  // own_site is checked before distance (contracts/README.md).
  admitVoter(deviceToken: string, from: GeoPoint): void {
    if (this.#internals.reporterDevices.includes(deviceToken)) {
      throw new OwnSiteError("You reported this site, so a neighbour has to check it");
    }
    if (this.#point.distanceTo(from) > VOTE_RADIUS_M) {
      throw new TooFarError("You need to be within 1 km of the site to vote");
    }
  }

  // Votes always count as corroborations but settle the site only during the community check.
  recordVotes(tally: VoteTally): void {
    const before = this.#props;
    const settled = before.verification === "community_check" ? tally.outcome() : null;
    const votes = { confirm: tally.confirm, reject: tally.reject };
    this.#props = { ...before, votes, verification: settled ?? before.verification };
    this.#recount();
  }

  startCleanup(cleanupId: string): void {
    if (this.#props.status === "cleaned") {
      throw new AlreadyCleanedError("This site is already marked cleared");
    }
    if (this.awaitsCleanup(cleanupId)) {
      return;
    }
    if (this.#props.cleanup_status === "checking") {
      throw new CleanupPendingError("An after-photo for this site is still being checked");
    }
    this.#props = { ...this.#props, cleanup_status: "checking" };
    this.#internals = { ...this.#internals, pendingCleanupId: cleanupId };
  }

  awaitsCleanup(cleanupId: string): boolean {
    return this.#props.cleanup_status === "checking" && this.#internals.pendingCleanupId === cleanupId;
  }

  acceptCleanup(cleanupId: string, photoUrl: string, cleanedAt: string): void {
    this.#assertAwaits(cleanupId);
    const cleared = { status: "cleaned", cleanup_status: "accepted", cleanup_photo_url: photoUrl } as const;
    this.#props = { ...this.#props, ...cleared, cleaned_at: cleanedAt };
    this.#internals = { ...this.#internals, pendingCleanupId: null };
  }

  rejectCleanup(cleanupId: string): void {
    this.#assertAwaits(cleanupId);
    this.#props = { ...this.#props, cleanup_status: "rejected" };
    this.#internals = { ...this.#internals, pendingCleanupId: null };
  }

  voteResult(): VoteResult {
    const { site_id, votes, verification } = this.#props;
    return { site_id, votes, verification };
  }

  toFeature(): SiteFeature {
    const geometry = { type: "Point", coordinates: this.#point.coordinates() } as const;
    return { type: "Feature", geometry, properties: this.#props };
  }

  snapshot(): SiteState {
    return { feature: this.toFeature(), internals: this.#internals };
  }

  #addReporter(report: MergeableReport): void {
    const { reportIds, reporterDevices, meTooCount, embeddingKey } = this.#internals;
    const knownDevice = reporterDevices.includes(report.deviceToken);
    const meToo = report.meTooSiteId === this.siteId && !knownDevice;
    this.#internals = {
      ...this.#internals,
      reportIds: [...reportIds, report.reportId],
      reporterDevices: knownDevice ? reporterDevices : [...reporterDevices, report.deviceToken],
      meTooCount: meTooCount + (meToo ? 1 : 0),
      embeddingKey: embeddingKey ?? report.embeddingKey,
    };
  }

  // verified_count counts reports the models auto-verified (docs/decisions/20261010-0253-hem-verified-count.md).
  #addEvidence(report: MergeableReport): void {
    const props = this.#props;
    const photos = report.photoUrl === null ? props.photo_urls : [report.photoUrl, ...props.photo_urls];
    this.#props = {
      ...props,
      report_count: props.report_count + 1,
      verified_count: props.verified_count + (report.autoVerified ? 1 : 0),
      photo_urls: newestPhotos(photos),
      burning: props.burning || (report.autoVerified && report.burning),
      brands: mergeBrands(props.brands, report.brands),
      first_reported_at: earlierTime(props.first_reported_at, report.reportedAt),
      last_reported_at: laterTime(props.last_reported_at, report.reportedAt),
    };
  }

  #confirmByReport(): void {
    const reopened = this.#props.status === "cleaned";
    this.#props = {
      ...this.#props,
      verification: "verified",
      status: reopened ? "reopened" : this.#props.status,
      cleanup_status: reopened ? "none" : this.#props.cleanup_status,
    };
  }

  #recount(): void {
    const corroborations = this.#internals.meTooCount + this.#props.votes.confirm;
    this.#props = { ...this.#props, corroborations };
  }

  #assertAwaits(cleanupId: string): void {
    if (!this.awaitsCleanup(cleanupId)) {
      throw new InvalidTransitionError(`${this.siteId} is not waiting for ${cleanupId}`);
    }
  }

  static #blankFeature(report: MergeableReport): SiteFeature {
    const properties: SiteProperties = {
      site_id: `site_${report.reportId.slice(REPORT_PREFIX.length)}`,
      report_type: report.reportType,
      context: report.context,
      status: "open",
      verification: "community_check",
      report_count: 0,
      verified_count: 0,
      corroborations: 0,
      votes: { confirm: 0, reject: 0 },
      photo_urls: [],
      cleanup_status: "none",
      cleanup_photo_url: null,
      burning: false,
      location: report.location,
      brands: [],
      first_reported_at: report.reportedAt,
      last_reported_at: report.reportedAt,
      cleaned_at: null,
      pilot: report.pilot,
    };
    return { type: "Feature", geometry: { type: "Point", coordinates: report.point.coordinates() }, properties };
  }

  static #blankInternals(): SiteInternals {
    return { reportIds: [], reporterDevices: [], meTooCount: 0, embeddingKey: null, pendingCleanupId: null, version: 0 };
  }
}
