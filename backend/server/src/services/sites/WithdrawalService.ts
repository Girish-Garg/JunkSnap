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
  // False on a retried call: the reports were already withdrawn, so there is nothing to save.
  readonly changed: boolean;
}

// Decision 20261010-1700: a signed-in reporter takes their reports off a site that is not verified yet.
export class WithdrawalService {
  readonly #deps: WithdrawalServiceDeps;

  constructor(deps: WithdrawalServiceDeps) {
    this.#deps = deps;
  }

  // Matched on the token's user id (the person backers count); a retried call takes no slot but still updates the rows.
  async withdraw(siteId: string, requester: Requester): Promise<WithdrawalResult> {
    const now = this.#deps.clock.now();
    const planned = await this.#apply(siteId, requester, now);
    const { site, result } = planned.changed ? await this.#save(siteId, requester, now) : planned;
    await this.#deps.withdrawer.markWithdrawn(result.withdrawn_report_ids, now.toISOString());
    await this.#deps.reports.followSite(site.reportIds, site.verification);
    return result;
  }

  // The limit is taken before the save, so a refused call leaves the site as it was.
  async #save(siteId: string, requester: Requester, now: Date): Promise<Applied> {
    await this.#deps.limiter.take(requester, now);
    return this.#deps.retry.run(async () => {
      const applied = await this.#apply(siteId, requester, now);
      if (applied.changed) {
        await this.#deps.sites.save(applied.site);
      }
      return applied;
    });
  }

  // Rows are read on every attempt and matched to the site's own report ids; a site report with no row stays unknown.
  async #request(site: Site, requester: Requester, now: Date): Promise<Withdrawal> {
    const rows = (await this.#deps.rows.forSite(site.siteId)).filter((row) => site.holds(row.reportId));
    const mine = rows.filter((row) => row.userId === requester.userId);
    if (mine.length === 0) {
      throw new NotFoundError("You have no report on this site");
    }
    return { mine, others: rows.filter((row) => row.userId !== requester.userId), at: now.toISOString() };
  }

  // Withdraws in memory only; a retried call finds the reports already withdrawn and answers the same way.
  async #apply(siteId: string, requester: Requester, now: Date): Promise<Applied> {
    const site = await this.#load(siteId);
    const request = await this.#request(site, requester, now);
    const result = site.withdraw(request);
    const held = WithdrawalService.#held(site, request.mine);
    if (held.length === 0) {
      throw new NotFoundError("You have no report on this site");
    }
    const changed = result.withdrawn_report_ids.length > 0;
    return { site, result: { ...result, withdrawn_report_ids: held }, changed };
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
