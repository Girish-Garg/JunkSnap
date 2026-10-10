import type { AreaLetterDraft, Site } from "../../contracts/index.gen.js";
import type { AreaKey, AreaKind } from "../AreaKey.js";
import { LetterSite } from "./LetterSite.js";

export type AreaIssue = AreaLetterDraft["issue"];
type Location = Site["properties"]["location"];

export interface StoredAreaSite {
  readonly site: Site;
  // One id per person (user id, else device); null on sites from before they were kept. Never leaves the api.
  readonly reporterIds: readonly string[] | null;
}

const AREA_REF: Readonly<Record<AreaKind, (location: Location) => { id: string; name: string } | null>> = {
  ward: (location) => location.ward,
  assembly: (location) => location.assembly_seat,
  loksabha: (location) => location.loksabha_seat,
  district: (location) => location.district,
};

// The sites of one area that a letter about one issue rests on; rejected sites never count.
export class AreaIssueSites {
  readonly area: AreaKey;
  readonly issue: AreaIssue;
  readonly #all: readonly StoredAreaSite[];

  constructor(area: AreaKey, issue: AreaIssue, sites: readonly StoredAreaSite[]) {
    this.area = area;
    this.issue = issue;
    this.#all = sites.filter((stored) => AREA_REF[area.kind](stored.site.properties.location)?.id === area.id);
  }

  hasSites(): boolean {
    return this.#all.some((stored) => stored.site.properties.verification !== "rejected");
  }

  name(): string {
    const [first] = this.#all;
    return first === undefined ? this.area.id : (AREA_REF[this.area.kind](first.site.properties.location)?.name ?? this.area.id);
  }

  counted(): StoredAreaSite[] {
    return this.#all.filter((stored) => this.#onIssue(stored.site) && stored.site.properties.verification !== "rejected");
  }

  verified(): StoredAreaSite[] {
    return this.counted().filter((stored) => stored.site.properties.verification === "verified");
  }

  verifiedReports(): number {
    return this.verified().reduce((total, stored) => total + stored.site.properties.verified_count, 0);
  }

  letterSites(): LetterSite[] {
    return this.verified().map((stored) => LetterSite.fromSite(stored.site));
  }

  // Null when no site has reporter ids yet; a site without them adds nothing.
  reporters(): number | null {
    const lists = this.counted().flatMap((stored) => (stored.reporterIds === null ? [] : [stored.reporterIds]));
    return lists.length === 0 ? null : new Set(lists.flat()).size || null;
  }

  #onIssue(site: Site): boolean {
    return this.issue === "all" || site.properties.report_type === this.issue;
  }
}
