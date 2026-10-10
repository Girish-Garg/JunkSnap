import { Backers } from "./Backers.js";
import { GeoPoint } from "./GeoPoint.js";
import { InsightMerge } from "./InsightMerge.js";
import { mergeRadiusM, publishedPoint, zoneCentre } from "./NoBinZone.js";
import type { MergeableReport } from "./MergeableReport.js";
import {
  AlreadyCleanedError,
  CleanupPendingError,
  InvalidTransitionError,
  OwnSiteError,
  SiteRejectedError,
  TooFarError,
} from "./SiteErrors.js";
import type { SiteFeature, SiteInternals, SiteProperties, SiteState, Verification, Voter, VoteResult } from "./SiteTypes.js";
import { SiteTemplate } from "./SiteTemplate.js";
import { earlierTime, laterTime, mergeBrands, newestPhotos, withItem } from "./utils.js";
import type { VoteTally } from "./VoteTally.js";

const VOTE_RADIUS_M = 1000;

// Lifecycle: open -> cleaned (accepted after-photo only) -> reopened (a new photo merges in).
// Verification: unverified -> verified at 10 backers, or rejected by the no-vote valve (decision 20261010-1530).
export class Site {
  #point: GeoPoint;
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

  get needsBackerCount(): boolean {
    return this.#internals.needsBackerCount;
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

  // Same type, within 40 m, not rejected; the models already passed the photo.
  accepts(report: MergeableReport): boolean {
    const { report_type, verification } = this.#props;
    if (report_type !== report.reportType || verification === "rejected") {
      return false;
    }
    return this.#point.distanceTo(report.point) <= mergeRadiusM(report_type);
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
    if (this.#props.report_type === "no_bin") {
      this.#point = zoneCentre(this.#internals.reports, this.#point);
    }
    this.#adoptBinMeasure(report);
    this.#reopenIfCleaned();
    this.#settle();
    this.#recount();
  }

  // A rejected site takes no votes; own_site (same user or device) is checked before distance.
  admitVoter(voter: Voter, from: GeoPoint): void {
    if (!this.isListed()) {
      throw new SiteRejectedError("This site was hidden after a neighbour check and takes no more votes");
    }
    if (this.#reportedBy(voter)) {
      throw new OwnSiteError("You reported this site, so a neighbour has to check it");
    }
    if (this.#point.distanceTo(from) > VOTE_RADIUS_M) {
      throw new TooFarError("You need to be within 1 km of the site to vote");
    }
  }

  // Votes always count, but only an unverified site can change verification.
  recordVotes(tally: VoteTally): void {
    this.#props = { ...this.#props, votes: { confirm: tally.confirm, reject: tally.reject } };
    this.#internals = { ...this.#internals, yesVoters: tally.yesPeople, noVoters: tally.noPeople };
    this.#settle();
    this.#recount();
  }

  // Migration to decision 20261010-1530: recounts from the stored photos and votes, forgetting the old verdict.
  rebuild(tally: VoteTally): void {
    const reports = this.#internals.reports.map((report) => ({ ...report, verified: false }));
    this.#internals = { ...this.#internals, reports, needsBackerCount: false, verifiedBackers: null };
    this.#props = { ...this.#props, verification: "unverified", verified_count: 0 };
    this.#refreshInsights();
    this.recordVotes(tally);
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
    const { site_id, votes, backers, verification } = this.#props;
    return { site_id, votes, backers, verification };
  }

  // The public Feature: a no-bin zone with one backer shows its centre only to about 100 m (decision 20261010-1630).
  toFeature(): SiteFeature {
    const shown = publishedPoint(this.#point, this.#props);
    return { type: "Feature", geometry: { type: "Point", coordinates: shown.coordinates() }, properties: this.#props };
  }

  // The stored state keeps the exact centre; zones merge on it.
  snapshot(): SiteState {
    const geometry = { type: "Point", coordinates: this.#point.coordinates() } as const;
    return { feature: { type: "Feature", geometry, properties: this.#props }, internals: this.#internals };
  }

  #addReporter(report: MergeableReport): void {
    const { reports, reporterDevices, reporterUsers, meTooCount, embeddingKey } = this.#internals;
    const meToo = report.meTooSiteId === this.siteId && !this.#reportedBy(report);
    const point = { lat: report.point.lat, lon: report.point.lon };
    const merged = { reportId: report.reportId, verified: false, insights: report.insights, point };
    this.#internals = {
      ...this.#internals,
      reports: [...reports, merged],
      reporterDevices: withItem(reporterDevices, report.deviceToken),
      reporterUsers: report.userId === null ? reporterUsers : withItem(reporterUsers, report.userId),
      reporterIds: withItem(this.#internals.reporterIds, report.userId ?? report.deviceToken),
      meTooCount: meTooCount + (meToo ? 1 : 0),
      embeddingKey: embeddingKey ?? report.embeddingKey,
    };
  }

  #addEvidence(report: MergeableReport): void {
    const props = this.#props;
    const photos = report.photoUrl === null ? props.photo_urls : [report.photoUrl, ...props.photo_urls];
    this.#props = {
      ...props,
      report_count: props.report_count + 1,
      photo_urls: newestPhotos(photos),
      brands: mergeBrands(props.brands, report.brands),
      first_reported_at: earlierTime(props.first_reported_at, report.reportedAt),
      last_reported_at: laterTime(props.last_reported_at, report.reportedAt),
    };
  }

  #reopenIfCleaned(): void {
    if (this.#props.status === "cleaned") {
      this.#props = { ...this.#props, status: "reopened", cleanup_status: "none" };
    }
  }

  // Backers are the photo people plus the yes voters; settling happens only while unverified.
  #settle(): void {
    const { reporterIds, yesVoters, noVoters, verifiedBackers } = this.#internals;
    const backers = new Backers(reporterIds, yesVoters, noVoters);
    const outcome = this.#props.verification === "unverified" ? backers.outcome() : null;
    const verification = outcome ?? this.#props.verification;
    const frozen = verification === "verified" ? backers.frozenAt(verifiedBackers) : null;
    this.#internals = { ...this.#internals, verifiedBackers: frozen };
    this.#props = { ...this.#props, backers: backers.view(frozen), verification };
    if (verification === "verified") {
      this.#confirmPendingReports();
    }
  }

  // Every report of a verified site counts as verified, including the ones that merge in later.
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
    const kept = this.#props.insights;
    const bin = { nearest_bin: kept?.nearest_bin ?? null, no_bin_within_3km: kept?.no_bin_within_3km ?? null };
    const insights = new InsightMerge(verified).merged(kept?.near ?? [], bin);
    const burning = insights.hazards.some((entry) => entry.hazard === "burning");
    this.#props = { ...this.#props, insights, burning };
  }

  // A site founded before bins were measured takes the first measured reading of a report merged into it.
  #adoptBinMeasure(report: MergeableReport): void {
    const insights = this.#props.insights;
    if (insights === undefined || typeof insights.no_bin_within_3km === "boolean" || report.bin.no_bin_within_3km === null) {
      return;
    }
    this.#props = { ...this.#props, insights: { ...insights, ...report.bin } };
  }

  #reportedBy(voter: Voter): boolean {
    const { reporterDevices, reporterUsers } = this.#internals;
    const sameUser = voter.userId !== null && reporterUsers.includes(voter.userId);
    return sameUser || reporterDevices.includes(voter.deviceToken);
  }

  #recount(): void {
    const corroborations = this.#internals.meTooCount + this.#props.votes.confirm;
    this.#props = { ...this.#props, corroborations, reporters: Math.max(1, this.#internals.reporterIds.length) };
  }

  #assertAwaits(cleanupId: string): void {
    if (!this.awaitsCleanup(cleanupId)) {
      throw new InvalidTransitionError(`${this.siteId} is not waiting for ${cleanupId}`);
    }
  }
}
