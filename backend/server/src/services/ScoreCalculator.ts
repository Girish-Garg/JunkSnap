import type { WardScores } from "../contracts/index.gen.js";
import type { AreaFactSheet } from "../domain/AreaFactSheet.js";
import type { ComputedAreaScores } from "../domain/AreaInsights.js";
import type { AreaRef } from "../domain/AreaKey.js";
import type { AreaSite } from "../domain/AreaSite.js";
import { AreaSites } from "../domain/AreaSites.js";
import { DataWindow } from "../domain/DataWindow.js";
import { isoSeconds, rounded } from "../domain/scoreUtils.js";
import { AreaInsightsBuilder } from "./AreaInsightsBuilder.js";
import { BinAccessScore, type BinAccessMeasure } from "./BinAccessScore.js";
import { CitizenScore, type CitizenMeasure } from "./CitizenScore.js";
import { CityScore, type CityMeasure } from "./CityScore.js";
import { Diagnoser } from "./Diagnoser.js";

export const FORMULA_VERSION = "scores-v3";
export const MIN_VERIFIED_REPORTS = 10;

export interface AreaInput {
  readonly area: AreaRef;
  readonly sites: readonly AreaSite[];
  readonly facts: AreaFactSheet;
  readonly now: Date;
}

export interface ScoreParts {
  readonly city: CityScore;
  readonly citizen: CitizenScore;
  readonly binAccess: BinAccessScore;
  readonly diagnoser: Diagnoser;
  readonly insights: AreaInsightsBuilder;
}

type Scored = Pick<WardScores, "scores" | "metrics" | "diagnosis">;
type Score = WardScores["scores"]["city"];

// scores-v3: docs/decisions/20261010-0238-hem-area-score-formulas.md, bin access from 20261010-1630, bin service from 20261010-1645.
export class ScoreCalculator {
  readonly #parts: ScoreParts;

  constructor(parts: ScoreParts) {
    this.#parts = parts;
  }

  static standard(): ScoreCalculator {
    return new ScoreCalculator({
      city: new CityScore(),
      citizen: new CitizenScore(),
      binAccess: new BinAccessScore(),
      diagnoser: new Diagnoser(),
      insights: AreaInsightsBuilder.standard(),
    });
  }

  calculate({ area, sites: list, facts, now }: AreaInput): ComputedAreaScores {
    const sites = new AreaSites(list);
    const window = DataWindow.over(sites, now);
    const counts = sites.counts();
    const enough = counts.verified_reports >= MIN_VERIFIED_REPORTS;
    return {
      area: { kind: area.kind, id: area.id, name: area.name },
      counts,
      min_verified_reports: MIN_VERIFIED_REPORTS,
      ...(enough ? this.#score(sites, window, facts) : ScoreCalculator.#withheld()),
      formula_version: FORMULA_VERSION,
      pilot: sites.isPilot(),
      data_window: window.toJSON(),
      computed_at: isoSeconds(now),
      insights: this.#parts.insights.build({ sites, window, facts, enough }),
    };
  }

  #score(sites: AreaSites, window: DataWindow, facts: AreaFactSheet): Scored {
    const { city, citizen, binAccess, diagnoser } = this.#parts;
    const clearing = city.measure(sites, window);
    const bins = binAccess.measure(sites);
    const { redumpedPct, medianDaysToClear, clearedWithin7DaysPct, binServicePct } = clearing;
    const people = citizen.measure({ sites, window, areaKm2: facts.areaKm2, redumpedPct });
    const scores = {
      city: ScoreCalculator.#scoreOf(clearing.value),
      citizen: ScoreCalculator.#scoreOf(citizen.adjust(people.raw, bins.value)),
      bin_access: ScoreCalculator.#scoreOf(bins.value),
    };
    const diagnosis = diagnoser.diagnose({
      citizenRaw: people.raw,
      binAccess: bins.value,
      medianDaysToClear,
      clearedWithin7DaysPct,
      redumpedPct,
      binServicePct,
    });
    return { scores, metrics: ScoreCalculator.#metrics(clearing, people, bins), diagnosis };
  }

  static #metrics(city: CityMeasure, citizen: CitizenMeasure, bins: BinAccessMeasure): WardScores["metrics"] {
    return {
      median_days_to_clear: rounded(city.medianDaysToClear, 1),
      cleared_within_7_days_pct: rounded(city.clearedWithin7DaysPct, 1),
      redumped_pct: rounded(city.redumpedPct, 1),
      no_bin_response_pct: rounded(city.noBinResponsePct, 1),
      bin_service_pct: rounded(city.binServicePct, 1),
      new_dumps_per_km2_month: rounded(citizen.newDumpsPerKm2Month, 1),
      share_vacant_plot_drain_roadside_pct: rounded(citizen.shareVacantPlotDrainRoadsidePct, 1),
      median_distance_to_disposal_m: rounded(bins.medianDistanceToBinM, 0),
      no_bin_within_3km_pct: rounded(bins.noBinWithin3kmPct, 1),
    };
  }

  static #scoreOf(value: number | null): Score {
    return value === null ? { value: null, reason: "no_data" } : { value: Math.round(value), reason: null };
  }

  static #withheld(): Scored {
    const withheld = (): Score => ({ value: null, reason: "too_few_reports" });
    const metrics = {
      median_days_to_clear: null,
      cleared_within_7_days_pct: null,
      redumped_pct: null,
      no_bin_response_pct: null,
      bin_service_pct: null,
      new_dumps_per_km2_month: null,
      share_vacant_plot_drain_roadside_pct: null,
      median_distance_to_disposal_m: null,
      no_bin_within_3km_pct: null,
    };
    return { scores: { city: withheld(), citizen: withheld(), bin_access: withheld() }, metrics, diagnosis: [] };
  }
}
