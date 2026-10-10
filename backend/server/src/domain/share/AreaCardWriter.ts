import type { WardScores } from "../../contracts/index.gen.js";
import type { AreaKind } from "../AreaKey.js";
import type { ShareCard } from "./ShareCard.js";
import type { ShareUrls } from "./ShareUrls.js";

const KIND_LABELS: Readonly<Record<AreaKind, string>> = {
  ward: "ward",
  assembly: "assembly seat",
  loksabha: "Lok Sabha seat",
  district: "district",
};
const SEPARATOR = " · ";

function counted(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}

// Counts only, as the area page shows them (contracts/README.md, Shared wording); the logo stands in for a photo.
export class AreaCardWriter {
  readonly #urls: ShareUrls;

  constructor(urls: ShareUrls) {
    this.#urls = urls;
  }

  card(scores: WardScores): ShareCard {
    const { kind, id, name } = scores.area;
    const title = `${name} ${KIND_LABELS[kind]}${SEPARATOR}JunkSnap area report`;
    const links = { pageUrl: this.#urls.sharedArea(kind, id), appUrl: this.#urls.appArea(kind, id) };
    return { ...links, status: 200, title, description: AreaCardWriter.#description(scores), image: this.#urls.logo() };
  }

  unknown(kind: string, areaId: string): ShareCard {
    const description = "Area reports from community-reported waste sites, with counts beside every score.";
    const links = { pageUrl: this.#urls.sharedArea(kind, areaId), appUrl: this.#urls.appHome() };
    return { ...links, status: 404, title: "JunkSnap", description, image: this.#urls.logo() };
  }

  static #description(scores: WardScores): string {
    const { verified_reports: verified, sites } = scores.counts;
    const min = scores.min_verified_reports;
    const reports = verified >= min
      ? counted(verified, "verified report", "verified reports")
      : `Not enough verified reports yet (${verified} of ${min})`;
    const parts = [reports, counted(sites, "site", "sites")];
    return (scores.pilot ? [...parts, "Pilot city"] : parts).join(SEPARATOR);
  }
}
