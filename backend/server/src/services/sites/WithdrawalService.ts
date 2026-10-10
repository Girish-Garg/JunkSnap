import { NotFoundError } from "../../domain/errors.js";
import type { Requester } from "../../domain/letters/types.js";
import type { Site } from "../../domain/sites/Site.js";
import { SiteNotFoundError } from "../../domain/sites/SiteErrors.js";
import type { SiteReportRef, Withdrawal, WithdrawalResult } from "../../domain/sites/Withdrawal.js";
import type { Clock } from "../../ports/sites/Clock.js";
import type { ReportStatusWriter } from "../../ports/sites/ReportStatusWriter.js";
import type { ReportWithdrawer } from "../../ports/sites/ReportWithdrawer.js";
import type { SiteReportReader } from "../../ports/sites/SiteReportReader.js";
import type { SiteRepository } from "../../ports/sites/SiteRepository.js";
import type { LetterRateLimiter } from "../letters/LetterRateLimiter.js";
import type { ConflictRetry } from "./ConflictRetry.js";

export interface WithdrawalServiceDeps {
  readonly sites: SiteRepository;
  readonly rows: SiteReportReader;
  readonly withdrawer: ReportWithdrawer;
  readonly reports: ReportStatusWriter;
  // Counts withdrawals per user and per device, like the other writes.
  readonly limiter: LetterRateLimiter;
  readonly clock: Clock;
  readonly retry: ConflictRetry;
}

interface Applied {
  readonly site: Site;
  readonly result: WithdrawalResult;
}

// Decision 20261010-1700: a signed-in reporter takes their reports off a site that is not verified yet.
export class WithdrawalService {
  readonly #deps: WithdrawalServiceDeps;

  constructor(deps: WithdrawalServiceDeps) {
    this.#deps = deps;
  }

  // Reports are matched on the token's user id, the person the backers and own_site rules count.
  async withdraw(siteId: string, requester: Requester): Promise<WithdrawalResult> {
    await this.#load(siteId);
    const now = this.#deps.clock.now();
    await this.#deps.limiter.fits(requester, now);
    const { site, result } = await this.#deps.retry.run(async () => this.#apply(siteId, await this.#request(siteId, requester, now)));
    await this.#deps.limiter.take(requester, now);
    await this.#deps.withdrawer.markWithdrawn(result.withdrawn_report_ids, now.toISOString());
    await this.#deps.reports.followSite(site.reportIds, site.verification);
    return result;
  }

  // Read on every attempt, so a report merged meanwhile is part of the recount.
  async #request(siteId: string, requester: Requester, now: Date): Promise<Withdrawal> {
    const rows = await this.#deps.rows.forSite(siteId);
    const mine = rows.filter((row) => row.userId === requester.userId);
    if (mine.length === 0) {
      throw new NotFoundError("You have no report on this site");
    }
    return { mine, others: rows.filter((row) => row.userId !== requester.userId), at: now.toISOString() };
  }

  // A retried call finds the reports already withdrawn and answers the same way without a second save.
  async #apply(siteId: string, request: Withdrawal): Promise<Applied> {
    const site = await this.#load(siteId);
    const result = site.withdraw(request);
    const held = WithdrawalService.#held(site, request.mine);
    if (held.length === 0) {
      throw new NotFoundError("You have no report on this site");
    }
    if (result.withdrawn_report_ids.length > 0) {
      await this.#deps.sites.save(site);
    }
    return { site, result: { ...result, withdrawn_report_ids: held } };
  }

  static #held(site: Site, mine: readonly SiteReportRef[]): string[] {
    return mine.filter((row) => site.holds(row.reportId)).map((row) => row.reportId);
  }

  async #load(siteId: string): Promise<Site> {
    const site = await this.#deps.sites.get(siteId);
    if (site === null) {
      throw new SiteNotFoundError(`No site ${siteId}`);
    }
    return site;
  }
}
