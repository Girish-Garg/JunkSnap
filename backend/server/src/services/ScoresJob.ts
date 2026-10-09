import { AreaKey } from "../domain/AreaKey.js";
import type { AreaSite } from "../domain/AreaSite.js";
import { AreaSites } from "../domain/AreaSites.js";
import type { AreaFacts } from "../ports/AreaFacts.js";
import type { AreaReportReader } from "../ports/AreaReportReader.js";
import type { AreaSiteReader } from "../ports/AreaSiteReader.js";
import type { Logger } from "../ports/Logger.js";
import type { ScoreRepository } from "../ports/ScoreRepository.js";
import type { AreaGroup, AreaGrouper } from "./AreaGrouper.js";
import type { ScoreCalculator } from "./ScoreCalculator.js";

export interface ScoresJobPorts {
  readonly sites: AreaSiteReader;
  readonly reports: AreaReportReader;
  readonly facts: AreaFacts;
  readonly scores: ScoreRepository;
}

export interface ScoresRunSummary {
  readonly sites: number;
  readonly areas: number;
  // Failed areas plus site items skipped for breaking the site contract.
  readonly failed: number;
}

type ReportTimes = Map<string, Promise<number[]>>;

// One CronJob run: recompute every area that holds a site and overwrite its row; one failing area never stops the rest.
export class ScoresJob {
  readonly #ports: ScoresJobPorts;
  readonly #calculator: ScoreCalculator;
  readonly #grouper: AreaGrouper;
  readonly #logger: Logger;

  constructor(ports: ScoresJobPorts, calculator: ScoreCalculator, grouper: AreaGrouper, logger: Logger) {
    this.#ports = ports;
    this.#calculator = calculator;
    this.#grouper = grouper;
    this.#logger = logger;
  }

  async run(now: Date): Promise<ScoresRunSummary> {
    const { sites, unreadable } = await this.#ports.sites.readAll();
    for (const { siteId, error } of unreadable) {
      this.#logger.error({ site_id: siteId, error }, "site skipped");
    }
    const groups = this.#grouper.group(sites);
    const times: ReportTimes = new Map();
    let failed = 0;
    for (const group of groups) {
      const area = AreaKey.of(group.area).toString();
      try {
        await this.#score(group, times, now);
      } catch (error) {
        failed += 1;
        this.#logger.error({ area, error }, "area scoring failed");
      }
    }
    return { sites: sites.length, areas: groups.length, failed: failed + unreadable.length };
  }

  async #score({ area, sites }: AreaGroup, times: ReportTimes, now: Date): Promise<void> {
    const timed: AreaSite[] = [];
    for (const site of sites) {
      timed.push(await this.#withReportTimes(site, times));
    }
    const facts = await this.#ports.facts.factsFor(AreaKey.of(area), new AreaSites(sites).localBodies());
    await this.#ports.scores.save(this.#calculator.calculate({ area, sites: timed, facts, now }));
  }

  // Each site's reports are read once, however many areas hold it; a failed read fails every one of those areas.
  async #withReportTimes(site: AreaSite, times: ReportTimes): Promise<AreaSite> {
    if (!site.isVerified() || site.verifiedReports() === 0) {
      return site;
    }
    const cached = times.get(site.id) ?? this.#ports.reports.verifiedReportTimes(site.id);
    times.set(site.id, cached);
    return site.withReportTimes(await cached);
  }
}
