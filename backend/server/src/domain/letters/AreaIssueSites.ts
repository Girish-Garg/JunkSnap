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
    return this.#onIssue().filter((stored) => this.#noBinProblem(stored.site) === null);
  }

  verified(): StoredAreaSite[] {
    return this.counted().filter((stored) => stored.site.properties.verification === "verified");
  }

  verifiedReports(): number {
    return this.verified().reduce((total, stored) => total + stored.site.properties.verified_count, 0);
  }

  // Why no-bin sites of the issue were left out, as "reason (n sites)" for the 409 message.
  noBinExclusions(): string[] {
    const reasons = this.#onIssue().flatMap((stored) => {
      const problem = this.#noBinProblem(stored.site);
      return problem === null ? [] : [problem];
    });
    const counts = new Map<string, number>();
    reasons.forEach((reason) => counts.set(reason, (counts.get(reason) ?? 0) + 1));
    return [...counts].map(([reason, count]) => `${reason} (${count} ${count === 1 ? "site" : "sites"})`);
  }

  letterSites(): LetterSite[] {
    return this.verified().map((stored) => LetterSite.fromSite(stored.site));
  }

  // Null when no site has reporter ids yet; a site without them adds nothing.
  reporters(): number | null {
    const lists = this.counted().flatMap((stored) => (stored.reporterIds === null ? [] : [stored.reporterIds]));
    return lists.length === 0 ? null : new Set(lists.flat()).size || null;
  }

  #onIssue(): StoredAreaSite[] {
    return this.#all.filter(({ site }) => {
      const matches = this.issue === "all" || site.properties.report_type === this.issue;
      return matches && site.properties.verification !== "rejected";
    });
  }

  // Decision 20261010-1630: a no-bin zone counts once 10 people confirmed it; a mapped bin nearby is evidence, not a gate.
  #noBinProblem(site: Site): string | null {
    const facts = site.properties;
    if (facts.report_type !== "no_bin" || facts.verification === "verified") {
      return null;
    }
    return "Fewer than 10 people have confirmed no dustbin within 1 km";
  }
}
