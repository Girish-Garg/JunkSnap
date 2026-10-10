import type { AreaKind, AreaRef } from "../../domain/AreaKey.js";
import type { AreaIssue } from "../../domain/letters/AreaIssueSites.js";
import type { CcLine, Recipient } from "../../domain/letters/types.js";
import type { AreaLetterBrief } from "../../ports/letters/AreaLetterWriter.js";
import type { AreaEvidence, AreaWording, WorstSite } from "./AreaTemplateLetter.js";
import { joinList, kilometres, letterDate } from "./utils.js";

const KIND: Readonly<Record<AreaKind, (name: string) => string>> = {
  ward: (name) => name,
  assembly: (name) => `${name} assembly constituency`,
  loksabha: (name) => `${name} Lok Sabha constituency`,
  district: (name) => `${name} district`,
};

const ISSUE: Readonly<Record<AreaIssue, string>> = {
  waste_dump: "waste dumps",
  no_bin: "places with no waste bin",
  contaminated_water: "contaminated water and drains",
  open_construction: "uncovered construction debris and dust",
  overflowing_bin: "overflowing or broken waste bins",
  all: "waste sites",
};

const REQUEST: Readonly<Record<AreaIssue, string>> = {
  waste_dump: "We request that these sites be cleared and that bins or collection points be provided where they are missing.",
  no_bin: "We request that waste bins be placed and regular collection be arranged at these places.",
  contaminated_water: "We request that the water and drains at these sites be cleaned and the sources of contamination be checked.",
  open_construction: "We request that the debris at these sites be covered or removed and that dust control measures be enforced.",
  overflowing_bin: "Please empty the bins regularly and repair or replace them.",
  all: "We request that the reported sites be cleared and that the causes behind them be addressed.",
};

const OFFICE: Readonly<Record<CcLine["office"], string>> = { councillor: "the councillor of", mla: "the MLA for", mp: "the MP for" };
const SCORE: Readonly<Record<string, string>> = { city: "city", citizen: "citizen", bin_access: "bin access" };

export class AreaEnglishWording implements AreaWording {
  readonly language = "en";
  readonly #binRadiusM: number;

  constructor(binRadiusM = 3000) {
    this.#binRadiusM = binRadiusM;
  }

  static areaName(area: AreaRef): string {
    return KIND[area.kind](area.name);
  }

  subject(brief: AreaLetterBrief): string {
    return `Request for action on ${ISSUE[brief.issue]} in ${AreaEnglishWording.areaName(brief.area)} (JunkSnap area report)`;
  }

  opening(to: readonly Recipient[]): string {
    const [only] = to;
    if (to.length === 1 && only !== undefined) {
      return `To the ${only.office}, ${only.body}.`;
    }
    return ["To:", ...to.map((recipient) => `- the ${recipient.office}, ${recipient.body}`)].join("\n");
  }

  facts(brief: AreaLetterBrief): string {
    const { reports, reporters, verified_reports, sites, first_reported_at } = brief.evidence;
    const people = reporters === null ? "" : ` from ${reporters} people`;
    const where = AreaEnglishWording.areaName(brief.area);
    return `Residents have reported ${ISSUE[brief.issue]} in ${where}: ${reports} reports${people} at ${sites} sites since ${letterDate(first_reported_at, "en-GB")}, ${verified_reports} of them verified.`;
  }

  worstSites(sites: readonly WorstSite[]): string {
    const lines = sites.map((site) => {
      const what = `${site.report_type.replaceAll("_", " ")} (${site.context.replaceAll("_", " ")})`;
      const photos = site.photo_urls.length > 0 ? ` Blurred photos: ${site.photo_urls.join(" ")}` : "";
      const since = letterDate(site.first_reported_at, "en-GB");
      return `- ${site.site_id}: ${what}, ${site.verified_count} verified of ${site.report_count} reports, ${site.status} since ${since}.${AreaEnglishWording.#insights(site)}${photos}`;
    });
    return ["Sites with the most verified reports:", ...lines].join("\n");
  }

  measured(evidence: AreaEvidence): string | null {
    const lines: string[] = [];
    const [first] = evidence.scores;
    if (first !== undefined) {
      const values = evidence.scores.map((score) => `${SCORE[score.name] ?? score.name} ${score.value}`);
      lines.push(`Measured area scores (0 to 100, higher is better), from ${first.verified_reports} verified reports: ${joinList(values, "and")}.`);
    }
    const bins = evidence.bin_access;
    if (bins !== null && bins.sites_measured > 0) {
      const km = kilometres(this.#binRadiusM);
      lines.push(`${bins.sites_without_bin_within_3km} of ${bins.sites_measured} measured sites have no known bin or collection point within ${km} km.`);
    }
    return lines.length === 0 ? null : lines.join("\n");
  }

  static #insights(site: WorstSite): string {
    const measured = site.insights;
    if (measured === null) {
      return "";
    }
    const parts = [
      ...measured.composition.slice(0, 2).map((share) => `${share.material} about ${Math.round(share.share_pct)}% (${share.reports} reports)`),
      ...(measured.size_class === null ? [] : [`${measured.size_class} pile`]),
      ...measured.near.map((place) => `${place.kind} within ${Math.round(place.distance_m)} m`),
    ];
    return parts.length === 0 ? "" : ` Measured: ${parts.join("; ")}.`;
  }

  rulesIntro(): string {
    return "The relevant provisions read:";
  }

  request(brief: AreaLetterBrief): string {
    return REQUEST[brief.issue];
  }

  closing(cc: readonly CcLine[]): string {
    const copies = cc.map((line) => `${OFFICE[line.office]} ${line.seat.name}`);
    return copies.length === 0
      ? "This letter is filed by a resident."
      : `This letter is filed by a resident. A copy goes for attention to ${joinList(copies, "and")}.`;
  }
}
