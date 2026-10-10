import { Backers } from "./Backers.js";
import { GeoPoint } from "./GeoPoint.js";
import { InsightMerge } from "./InsightMerge.js";
import { mergeRadiusM, publishedPoint } from "./NoBinZone.js";
import type { MergeableReport } from "./MergeableReport.js";
import {
  AlreadyCleanedError,
  CleanupPendingError,
  InvalidTransitionError,
  OwnSiteError,
  SiteRejectedError,
  SiteRemovedError,
  SiteVerifiedError,
  TooFarError,
} from "./SiteErrors.js";
import type { PhotoUrls, SiteFeature, SiteInternals, SiteProperties, SiteState, Verification, VoteChoice, Voter, VoteResult } from "./SiteTypes.js";
import { SiteAddition } from "./SiteAddition.js";
import { SiteTemplate } from "./SiteTemplate.js";
import { SiteWithdrawal } from "./SiteWithdrawal.js";
import { reportedBy } from "./utils.js";
import type { VoteTally } from "./VoteTally.js";
import type { Withdrawal, WithdrawalResult } from "./Withdrawal.js";

const VOTE_RADIUS_M = 1000;

// Lifecycle: open -> cleaned (accepted after-photo or cleared votes) -> reopened (a new photo merges in); removed when withdrawn.
// Verification: unverified -> verified at 10 backers, or rejected by the no-vote valve (decision 20261010-1530).
export class Site {
  #point!: GeoPoint;
  #props!: SiteProperties;
  #internals!: SiteInternals;

  private constructor(state: SiteState) {
    this.#adopt(state);
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

  // A withdrawn report still counts as held, so a redelivered merge changes nothing.
  holds(reportId: string): boolean {
    const { reports, withdrawnReports } = this.#internals;
    return reports.some((report) => report.reportId === reportId) || withdrawnReports.includes(reportId);
  }

  // On the active map: not rejected, removed or cleaned (decision 20261010-1700).
  isListed(): boolean {
    const { verification, status } = this.#props;
    return verification !== "rejected" && status !== "removed" && status !== "cleaned";
  }

  // Same type, within 40 m, not rejected or removed; the models already passed the photo.
  accepts(report: MergeableReport): boolean {
    const { report_type, verification, status } = this.#props;
    if (report_type !== report.reportType || verification === "rejected" || status === "removed") {
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
    this.#adopt(new SiteAddition(this.snapshot(), report).apply());
    this.#reopenIfCleaned();
    this.#settle();
    this.#recount();
  }

  // A rejected or removed site takes no votes; own_site (same user or device) is checked before distance.
  admitVoter(voter: Voter, from: GeoPoint, choice: VoteChoice = "confirm"): void {
    this.#assertNotRemoved();
    if (this.#props.verification === "rejected") {
      throw new SiteRejectedError("This site was hidden after a neighbour check and takes no more votes");
    }
    if (choice === "cleaned" && this.#props.status === "cleaned") {
      throw new AlreadyCleanedError("This site is already marked cleared");
    }
    if (reportedBy(this.#internals, voter)) {
      throw new OwnSiteError("You reported this site, so a neighbour has to check it");
    }
    if (this.#point.distanceTo(from) > VOTE_RADIUS_M) {
      throw new TooFarError("You need to be within 1 km of the site to vote");
    }
  }

  // Votes always count, but only an unverified site can change verification; cleared votes can clean any open site.
  recordVotes(tally: VoteTally): void {
    this.#props = { ...this.#props, votes: { confirm: tally.confirm, reject: tally.reject, cleaned: tally.cleaned } };
    this.#internals = { ...this.#internals, yesVoters: tally.yesPeople, noVoters: tally.noPeople };
    this.#settle();
    this.#clearIfVoted(tally);
    this.#recount();
  }

  // Decision 20261010-1700: the reporter takes their reports back while the site is not verified.
  withdraw(request: Withdrawal): WithdrawalResult {
    if (this.#props.verification === "verified") {
      throw new SiteVerifiedError("Ten people have verified this site, so your report stays");
    }
    const withdrawal = new SiteWithdrawal(this.snapshot(), request);
    const ids = withdrawal.withdrawnIds();
    // Nothing left to withdraw (a retried call) changes nothing.
    if (ids.length > 0) {
      this.#adopt(withdrawal.apply());
      this.#resettle();
    }
    const { site_id, status, verification, backers } = this.#props;
    return { site_id, withdrawn_report_ids: ids, site_removed: status === "removed", status, verification, backers };
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
    this.#assertNotRemoved();
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
    this.#assertNotRemoved();
    this.#assertAwaits(cleanupId);
    const cleared = { status: "cleaned", cleanup_status: "accepted", cleanup_photo_url: photoUrl, cleaned_by: "after_photo" } as const;
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
  // A removed site shows no photo; the stored item keeps the URLs for the audit trail (decision 20261010-1700).
  toFeature(): SiteFeature {
    const shown = publishedPoint(this.#point, this.#props);
    const properties = this.#props.status === "removed" ? { ...this.#props, photo_urls: [] as PhotoUrls } : this.#props;
    return { type: "Feature", geometry: { type: "Point", coordinates: shown.coordinates() }, properties };
  }

  // The stored state keeps the exact centre; zones merge on it.
  snapshot(): SiteState {
    const geometry = { type: "Point", coordinates: this.#point.coordinates() } as const;
    return { feature: { type: "Feature", geometry, properties: this.#props }, internals: this.#internals };
  }

  #clearIfVoted(tally: VoteTally): void {
    const at = tally.clearedAt(this.#props.last_reported_at);
    if (at === null || this.#props.status === "cleaned" || this.#props.status === "removed") {
      return;
    }
    this.#props = { ...this.#props, status: "cleaned", cleaned_at: at, cleaned_by: "votes" };
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

  #recount(): void {
    const corroborations = this.#internals.meTooCount + this.#props.votes.confirm;
    this.#props = { ...this.#props, corroborations, reporters: Math.max(1, this.#internals.reporterIds.length) };
  }

  // A removed site keeps its counts as they were, for the audit trail.
  #resettle(): void {
    if (this.#props.status !== "removed") {
      this.#settle();
      this.#recount();
    }
  }

  #assertNotRemoved(): void {
    if (this.#props.status === "removed") {
      throw new SiteRemovedError("This site was withdrawn by its reporter");
    }
  }

  #adopt(state: SiteState): void {
    const [lon, lat] = state.feature.geometry.coordinates;
    this.#point = new GeoPoint(lat, lon);
    this.#props = state.feature.properties;
    this.#internals = state.internals;
  }

  #assertAwaits(cleanupId: string): void {
    if (!this.awaitsCleanup(cleanupId)) {
      throw new InvalidTransitionError(`${this.siteId} is not waiting for ${cleanupId}`);
    }
  }
}
