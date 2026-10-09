import { GeoPoint } from "./GeoPoint.js";
import { InsightMerge } from "./InsightMerge.js";
import type { MergeableReport } from "./MergeableReport.js";
import {
  AlreadyCleanedError,
  CleanupPendingError,
  InvalidTransitionError,
  OwnSiteError,
  TooFarError,
} from "./SiteErrors.js";
import type { SiteFeature, SiteInternals, SiteProperties, SiteState, Verification, Voter, VoteResult } from "./SiteTypes.js";
import { SiteTemplate } from "./SiteTemplate.js";
import { earlierTime, laterTime, mergeBrands, newestPhotos, withItem } from "./utils.js";
import type { VoteTally } from "./VoteTally.js";

export const MERGE_RADIUS_M = 40;
const VOTE_RADIUS_M = 1000;

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

  static found(report: MergeableReport): Site {
    const template = new SiteTemplate(report);
    const site = new Site({ feature: template.feature(), internals: template.internals() });
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
    return this.#internals.reports.map((report) => report.reportId);
  }

  get embeddingKey(): string | null {
    return this.#internals.embeddingKey;
  }

  get version(): number {
    return this.#internals.version;
  }

  holds(reportId: string): boolean {
    return this.#internals.reports.some((report) => report.reportId === reportId);
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
      this.#refreshInsights();
    }
    this.#recount();
  }

  // own_site (same user or same device) is checked before distance (contracts/README.md).
  admitVoter(voter: Voter, from: GeoPoint): void {
    if (this.#reportedBy(voter)) {
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
    if (settled === "verified") {
      this.#confirmPendingReports();
    }
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
    const { reports, reporterDevices, reporterUsers, meTooCount, embeddingKey } = this.#internals;
    const meToo = report.meTooSiteId === this.siteId && !this.#reportedBy(report);
    const merged = { reportId: report.reportId, verified: report.autoVerified, insights: report.insights };
    this.#internals = {
      ...this.#internals,
      reports: [...reports, merged],
      reporterDevices: withItem(reporterDevices, report.deviceToken),
      reporterUsers: report.userId === null ? reporterUsers : withItem(reporterUsers, report.userId),
      meTooCount: meTooCount + (meToo ? 1 : 0),
      embeddingKey: embeddingKey ?? report.embeddingKey,
    };
  }

  // verified_count: docs/decisions/20261010-0253-hem-verified-count.md.
  #addEvidence(report: MergeableReport): void {
    const props = this.#props;
    const photos = report.photoUrl === null ? props.photo_urls : [report.photoUrl, ...props.photo_urls];
    this.#props = {
      ...props,
      report_count: props.report_count + 1,
      verified_count: props.verified_count + (report.autoVerified ? 1 : 0),
      photo_urls: newestPhotos(photos),
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

  // Neighbours confirmed the site, so every report still waiting on that check counts as verified.
  #confirmPendingReports(): void {
    const pending = this.#internals.reports.filter((report) => !report.verified).length;
    const reports = this.#internals.reports.map((report) => ({ ...report, verified: true }));
    this.#internals = { ...this.#internals, reports };
    this.#props = { ...this.#props, verified_count: this.#props.verified_count + pending };
    this.#refreshInsights();
  }

  // Insights and burning come from the verified reports only; burning exactly when a hazard says so.
  #refreshInsights(): void {
    const verified = this.#internals.reports.flatMap((report) =>
      report.verified && report.insights !== null ? [report.insights] : [],
    );
    const insights = new InsightMerge(verified).merged(this.#props.insights?.near ?? []);
    const burning = insights.hazards.some((entry) => entry.hazard === "burning");
    this.#props = { ...this.#props, insights, burning };
  }

  #reportedBy(voter: Voter): boolean {
    const { reporterDevices, reporterUsers } = this.#internals;
    const sameUser = voter.userId !== null && reporterUsers.includes(voter.userId);
    return sameUser || reporterDevices.includes(voter.deviceToken);
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
}
