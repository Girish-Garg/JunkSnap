import { expiryOf, isLapsed, refreshedExpiry } from "../SiteExpiry.js";
import { Backers } from "./Backers.js";
import { GeoPoint } from "./GeoPoint.js";
import { InsightMerge } from "./InsightMerge.js";
import { mergeRadiusM, publishedPoint } from "./NoBinZone.js";
import type { MergeableReport } from "./MergeableReport.js";
import * as Errors from "./SiteErrors.js";
import type { PhotoFlagState } from "../flags/PhotoFlag.js";
import type { SiteRules } from "./SiteRules.js";
import type { PhotoUrls, SiteFeature, SiteInternals, SiteProperties, SiteState, Verification, VoteChoice, Voter, VoteResult } from "./SiteTypes.js";
import { SiteAddition } from "./SiteAddition.js";
import { SiteCleanup, type AfterPhoto, type SiteParts } from "./SiteCleanup.js";
import { SitePhotoFlags, type PhotoFlagCount } from "./SitePhotoFlags.js";
import { ReportedPhotoRemoval } from "./ReportedPhotoRemoval.js";
import { SiteTemplate } from "./SiteTemplate.js";
import { SiteWithdrawal } from "./SiteWithdrawal.js";
import { distanceText, reportedBy } from "./utils.js";
import type { VoteTally } from "./VoteTally.js";
import type { Withdrawal, WithdrawalResult } from "./Withdrawal.js";

// Lifecycle: open -> cleaned (CLEANED_QUORUM people: after-photos or cleared votes) -> reopened (a new photo merges in);
// removed when withdrawn; expired after SITE_TTL_DAYS without activity (decision 20261010-1855).
// Verification: unverified -> verified at 10 backers, or rejected by the no-vote valve (decision 20261010-1530).
export class Site {
  #point!: GeoPoint;
  #props!: SiteProperties;
  #internals!: SiteInternals;
  readonly #rules: SiteRules;

  private constructor(state: SiteState, rules: SiteRules) {
    this.#rules = rules;
    this.#adopt(state);
  }

  static restore(state: SiteState, rules: SiteRules): Site {
    return new Site(state, rules);
  }

  static found(report: MergeableReport, rules: SiteRules): Site {
    const template = new SiteTemplate(report);
    const site = new Site({ feature: template.feature(), internals: template.internals() }, rules);
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

  isRemoved(): boolean {
    return this.#props.status === "removed";
  }

  // On the active map: not rejected, removed, cleaned or expired (decisions 20261010-1700 and 20261010-1855).
  isListed(): boolean {
    const { verification, status } = this.#props;
    return verification !== "rejected" && status !== "removed" && status !== "cleaned" && status !== "expired";
  }

  // Lazy expiry on read: the stored row may not be marked yet; the scores CronJob writes the status.
  expireIfLapsed(now: Date): void {
    if (isLapsed(this.#props, now, this.#rules.ttlDays)) {
      this.#props = { ...this.#props, status: "expired" };
    }
  }

  // Same type, within the merge radius, not rejected, removed or expired when the photo was taken; the models already passed it.
  accepts(report: MergeableReport): boolean {
    const { report_type, verification, status } = this.#props;
    if (report_type !== report.reportType || verification === "rejected" || status === "removed") {
      return false;
    }
    const lapsed = isLapsed(this.#props, new Date(report.reportedAt), this.#rules.ttlDays);
    return !lapsed && this.#point.distanceTo(report.point) <= mergeRadiusM(report_type, this.#rules);
  }

  merge(report: MergeableReport): void {
    if (this.holds(report.reportId)) {
      return;
    }
    if (!this.accepts(report)) {
      throw new Errors.InvalidTransitionError(`${report.reportId} cannot merge into ${this.siteId}`);
    }
    this.#adopt(new SiteAddition(this.snapshot(), report).apply());
    this.#apply(this.#cleanup().reopen());
    this.#touch(report.reportedAt);
    this.#settle();
    this.#recount();
  }

  // A rejected, removed or expired site takes no votes; own_site (same user or device) is checked before distance.
  admitVoter(voter: Voter, from: GeoPoint, choice: VoteChoice, at: Date): void {
    this.assertActive(at);
    if (this.#props.verification === "rejected") {
      throw new Errors.SiteRejectedError("This site was hidden after a neighbour check and takes no more votes");
    }
    if (choice === "cleaned" && this.#props.status === "cleaned") {
      throw new Errors.AlreadyCleanedError("This site is already marked cleared");
    }
    if (reportedBy(this.#internals, voter)) {
      throw new Errors.OwnSiteError("You reported this site, so a neighbour has to check it");
    }
    if (this.#point.distanceTo(from) > this.#rules.voteRadiusM) {
      throw new Errors.TooFarError(`You need to be within ${distanceText(this.#rules.voteRadiusM)} of the site to vote`);
    }
  }

  // Votes always count, but only an unverified site can change verification; cleared votes can clean any open site.
  // A removed site keeps its verification and backers as they were, like #resettle.
  recordVotes(tally: VoteTally): void {
    this.#props = { ...this.#props, votes: { confirm: tally.confirm, reject: tally.reject, cleaned: tally.cleaned } };
    this.#internals = { ...this.#internals, yesVoters: tally.yesPeople, noVoters: tally.noPeople };
    if (this.isRemoved()) {
      return;
    }
    this.#settle();
    this.#apply(this.#cleanup().settle(tally));
    this.#recount();
    this.#touch(tally.lastVotedAt());
  }

  // Decision 20261010-1700: the reporter takes their reports back while the site is not verified.
  withdraw(request: Withdrawal): WithdrawalResult {
    if (this.#props.verification === "verified") {
      throw new Errors.SiteVerifiedError("Ten people have verified this site, so your report stays");
    }
    const withdrawal = new SiteWithdrawal(this.snapshot(), request);
    const ids = withdrawal.withdrawnIds();
    // Nothing left to withdraw (a retried call) changes nothing.
    if (ids.length > 0) {
      this.#adopt(withdrawal.apply());
      this.#resettle();
      this.#adopt(new ReportedPhotoRemoval(this.snapshot(), this.#rules.flags).apply(request.at));
    }
    const { site_id, status, verification, backers } = this.#props;
    return { site_id, withdrawn_report_ids: ids, site_removed: status === "removed", status, verification, backers };
  }

  // Decision 20261011-0310-hem-photo-flags: a photo many people reported is warned, then hidden; see SitePhotoFlags.
  recordPhotoFlags(count: PhotoFlagCount): PhotoFlagState {
    const flags = new SitePhotoFlags(this.snapshot(), count, this.#rules.flags);
    this.#adopt(flags.apply());
    return flags.photo();
  }

  // Migration to decision 20261010-1530: recounts from the stored photos and votes, forgetting the old verdict.
  rebuild(tally: VoteTally): void {
    const reports = this.#internals.reports.map((report) => ({ ...report, verified: false }));
    this.#internals = { ...this.#internals, reports, needsBackerCount: false, verifiedBackers: null };
    this.#props = { ...this.#props, verification: "unverified", verified_count: 0 };
    this.#refreshInsights();
    this.recordVotes(tally);
  }

  startCleanup(cleanupId: string, at: Date): void {
    this.assertActive(at);
    this.#apply(this.#cleanup().start(cleanupId));
  }

  awaitsCleanup(cleanupId: string): boolean {
    return this.#cleanup().awaits(cleanupId);
  }

  // One person's word that it is cleared; the site is cleaned only once CLEANED_QUORUM people say so (decision 20261010-1855).
  // Only an accepted photo refreshes the expiry, so rejected junk photos cannot keep a site alive.
  acceptCleanup(photo: AfterPhoto, tally: VoteTally): void {
    this.#assertNotRemoved();
    this.#apply(this.#cleanup().accept(photo, tally));
    this.#touch(photo.at);
  }

  rejectCleanup(cleanupId: string): void {
    this.#apply(this.#cleanup().reject(cleanupId));
  }

  voteResult(): VoteResult {
    const { site_id, votes, backers, verification } = this.#props;
    return { site_id, votes, backers, verification };
  }

  // The public Feature: a no-bin zone with one backer shows its centre only to about 100 m (decision 20261010-1630).
  // A removed site shows no photo or after-photo; the stored item keeps the URLs for the audit trail (decision 20261010-1700).
  // A row from before decision 20261010-1855 shows the expiry its last report sets.
  toFeature(): SiteFeature {
    const shown = publishedPoint(this.#point, this.#props);
    const hidden = { photo_urls: [] as PhotoUrls, cleanup_photo_url: null };
    const dated = { ...this.#props, expires_at: expiryOf(this.#props, this.#rules.ttlDays) };
    const properties = this.isRemoved() ? { ...dated, ...hidden } : dated;
    return { type: "Feature", geometry: { type: "Point", coordinates: shown.coordinates() }, properties };
  }

  // The stored state keeps the exact centre; zones merge on it.
  snapshot(): SiteState {
    const geometry = { type: "Point", coordinates: this.#point.coordinates() } as const;
    return { feature: { type: "Feature", geometry, properties: this.#props }, internals: this.#internals };
  }

  #cleanup(): SiteCleanup {
    return new SiteCleanup({ props: this.#props, internals: this.#internals }, this.#rules);
  }

  #apply({ props, internals }: SiteParts): void {
    this.#props = props;
    this.#internals = internals;
  }

  // Activity pushes the expiry later; a site off the map for good keeps its own.
  #touch(at: string | null): void {
    const { status } = this.#props;
    if (at !== null && status !== "removed" && status !== "expired") {
      this.#props = { ...this.#props, expires_at: refreshedExpiry(this.#props, at, this.#rules.ttlDays) };
    }
  }

  // Backers are the photo people plus the yes voters; settling happens only while unverified.
  #settle(): void {
    const { reporterIds, yesVoters, noVoters, verifiedBackers } = this.#internals;
    const backers = new Backers(reporterIds, yesVoters, noVoters, this.#rules.rejectMargin);
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
      throw new Errors.SiteRemovedError("This site was withdrawn by its reporter");
    }
  }

  // Votes and cleanups need a site that is neither removed nor expired at this time (decision 20261010-1855).
  assertActive(at: Date): void {
    this.#assertNotRemoved();
    if (isLapsed(this.#props, at, this.#rules.ttlDays)) {
      throw new Errors.SiteExpiredError(`This site expired after ${this.#rules.ttlDays} days without a new report, vote or after-photo`);
    }
  }

  #adopt(state: SiteState): void {
    const [lon, lat] = state.feature.geometry.coordinates;
    this.#point = new GeoPoint(lat, lon);
    this.#props = state.feature.properties;
    this.#internals = state.internals;
  }
}
