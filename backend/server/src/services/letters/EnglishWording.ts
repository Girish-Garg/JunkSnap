import type { LetterSite } from "../../domain/letters/LetterSite.js";
import type { CcLine, Recipient, ReportType, SiteContext } from "../../domain/letters/types.js";
import type { TemplateWording } from "./TemplateLetter.js";
import { coordinates, joinList, kilometres, letterDate } from "./utils.js";

// Each no-bin report says no dustbin within this radius (decision 20261010-1630).
const ZONE_RADIUS_M = 1000;
const WHAT: Readonly<Record<SiteContext, string>> = {
  vacant_plot: "a waste dump on a vacant plot",
  roadside: "a waste dump by the roadside",
  drain: "waste dumped in a drain",
  other: "a waste dump",
  no_bin: "a place with no waste bin",
  no_pickup: "waste that is not being picked up",
  stagnant: "stagnant contaminated water",
  sewage: "a sewage overflow",
  foam: "foaming contaminated water",
  choked_drain: "a choked drain",
  uncovered_debris: "uncovered construction debris",
  dusty_site: "a dusty construction site",
  overflowing: "an overflowing waste bin with waste spilling around it",
  damaged: "a broken, burnt or uncovered waste bin",
};

const REQUEST: Readonly<Record<ReportType, string>> = {
  waste_dump: "We request that the site be cleared and that a bin or collection point be provided nearby.",
  no_bin: "We request that waste bins be placed here and that regular collection be arranged.",
  contaminated_water: "We request that the water and drains here be cleaned and the source of contamination be checked.",
  open_construction: "We request that the debris be covered or removed and that dust control measures be enforced.",
  overflowing_bin: "Please empty the bin regularly and repair or replace it.",
};

const OFFICE: Readonly<Record<CcLine["office"], string>> = {
  councillor: "the councillor of",
  mla: "the MLA for",
  mp: "the MP for",
};

export class EnglishWording implements TemplateWording {
  readonly language = "en";
  readonly #binRadiusM: number;

  constructor(binRadiusM = 3000) {
    this.#binRadiusM = binRadiusM;
  }

  subject(site: LetterSite): string {
    return `Request for action on ${WHAT[site.context]} in ${site.place.name()} (JunkSnap site ${site.siteId})`;
  }

  opening(to: Recipient): string {
    return `To the ${to.office}, ${to.body}.`;
  }

  facts(site: LetterSite): string {
    const { lat, lon, reportCount, verifiedCount, firstReportedAt, photoUrls } = site.evidence;
    const lines = [
      `Residents have reported ${WHAT[site.context]} in ${site.place.name()}, at ${coordinates(lat, lon)}.`,
      `Reports since ${letterDate(firstReportedAt, "en-GB")}: ${reportCount} (${verifiedCount} verified).`,
    ];
    if (site.burning) {
      lines.push("Burning has been seen at this site.");
    }
    const photos = photoUrls.length > 0 ? `\nBlurred photos: ${photoUrls.join(" ")}` : "";
    return `${lines.join(" ")}${photos}`;
  }

  rulesIntro(): string {
    return "The relevant provisions read:";
  }

  request(site: LetterSite): string {
    if (site.reportType !== "no_bin") {
      return REQUEST[site.reportType];
    }
    const people = `${site.evidence.reporters ?? 10} people confirmed there is no dustbin within 1 km of this spot.`;
    const bin = site.evidence.nearestBin;
    const mapped =
      bin !== null && bin.distance_m <= ZONE_RADIUS_M
        ? `A mapped bin is ${Math.round(bin.distance_m)} m away (OpenStreetMap, ward records); it may be missing or broken.`
        : `No mapped bin or collection point within ${kilometres(this.#binRadiusM)} km (OpenStreetMap, ward records).`;
    return `${people} ${mapped} ${REQUEST.no_bin}`;
  }

  closing(cc: readonly CcLine[]): string {
    const filed = "This letter is filed by a resident.";
    if (cc.length === 0) {
      return filed;
    }
    const copies = cc.map((line) => `${OFFICE[line.office]} ${line.seat.name}`);
    return `${filed} Copies go for attention to ${joinList(copies, "and")}.`;
  }
}
