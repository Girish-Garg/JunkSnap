import type { MergeableReport } from "../../src/domain/sites/MergeableReport.js";
import type { SiteReportRef } from "../../src/domain/sites/Withdrawal.js";
import type { ReportWithdrawer } from "../../src/ports/sites/ReportWithdrawer.js";
import type { SiteReportReader } from "../../src/ports/sites/SiteReportReader.js";
import { LetterRateLimiter } from "../../src/services/letters/LetterRateLimiter.js";
import { ConflictRetry } from "../../src/services/sites/ConflictRetry.js";
import { WithdrawalService } from "../../src/services/sites/WithdrawalService.js";
import { memoryCounters, RecordingLogger } from "../letters/support.js";
import { FakeReportStatus, FakeSiteRepository, FixedClock } from "./fakes.js";
import { RETRY } from "../defaults.js";

// The reports table's by-site index, filled from the reports merged in a test.
export class FakeSiteReports implements SiteReportReader {
  readonly #rows = new Map<string, SiteReportRef[]>();

  add(siteId: string, report: MergeableReport): void {
    const { reportId, userId, deviceToken, reportedAt, brands, photoUrl } = report;
    const row = { reportId, userId, deviceToken, reportedAt, brands, photoUrl };
    this.#rows.set(siteId, [...(this.#rows.get(siteId) ?? []), row]);
  }

  async forSite(siteId: string): Promise<SiteReportRef[]> {
    return this.#rows.get(siteId) ?? [];
  }
}

export class FakeWithdrawer implements ReportWithdrawer {
  readonly withdrawn = new Map<string, string>();

  async markWithdrawn(reportIds: readonly string[], at: string): Promise<void> {
    reportIds.forEach((reportId) => this.withdrawn.set(reportId, at));
  }
}

export interface WithdrawalRig {
  readonly service: WithdrawalService;
  readonly sites: FakeSiteRepository;
  readonly rows: FakeSiteReports;
  readonly withdrawer: FakeWithdrawer;
  readonly statuses: FakeReportStatus;
}

export function withdrawalRig(sites = new FakeSiteRepository(), limit = 10): WithdrawalRig {
  const rows = new FakeSiteReports();
  const withdrawer = new FakeWithdrawer();
  const statuses = new FakeReportStatus();
  const service = new WithdrawalService({
    sites,
    rows,
    withdrawer,
    reports: statuses,
    limiter: new LetterRateLimiter(memoryCounters(), new RecordingLogger(), limit, "withdrawals"),
    clock: new FixedClock(),
    retry: new ConflictRetry(RETRY.saveAttempts),
  });
  return { service, sites, rows, withdrawer, statuses };
}
