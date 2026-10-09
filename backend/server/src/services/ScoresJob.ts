import { AreaKey } from "../domain/AreaKey.js";
import type { AreaSite } from "../domain/AreaSite.js";
import type { AreaFacts } from "../ports/AreaFacts.js";
import type { AreaReportReader } from "../ports/AreaReportReader.js";
import type { AreaSiteReader } from "../ports/AreaSiteReader.js";
import type { ScoreRepository } from "../ports/ScoreRepository.js";
import type { AreaGrouper } from "./AreaGrouper.js";
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
}

// One CronJob run: recompute every area that holds a site and overwrite its row.
export class ScoresJob {
  readonly #ports: ScoresJobPorts;
  readonly #calculator: ScoreCalculator;
  readonly #grouper: AreaGrouper;

  constructor(ports: ScoresJobPorts, calculator: ScoreCalculator, grouper: AreaGrouper) {
    this.#ports = ports;
    this.#calculator = calculator;
    this.#grouper = grouper;
  }

  async run(now: Date): Promise<ScoresRunSummary> {
    const sites = await this.#withReportTimes(await this.#ports.sites.readAll());
    const groups = this.#grouper.group(sites);
    for (const { area, sites: areaSites } of groups) {
      const facts = await this.#ports.facts.factsFor(AreaKey.of(area));
      await this.#ports.scores.save(this.#calculator.calculate({ area, sites: areaSites, facts, now }));
    }
    return { sites: sites.length, areas: groups.length };
  }

  // Each site is read once, however many areas hold it.
  async #withReportTimes(sites: readonly AreaSite[]): Promise<AreaSite[]> {
    const timed: AreaSite[] = [];
    for (const site of sites) {
      const needed = site.isVerified() && site.verifiedReports() > 0;
      timed.push(needed ? site.withReportTimes(await this.#ports.reports.verifiedReportTimes(site.id)) : site);
    }
    return timed;
  }
}
