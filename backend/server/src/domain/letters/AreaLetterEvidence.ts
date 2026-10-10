import type { AreaLetterDraft, Site, WardScores } from "../../contracts/index.gen.js";
import { InternalDataError } from "../errors.js";
import { flagged, SIGNAL_FLAGS } from "../notes/Community.js";
import type { AreaIssueSites, StoredAreaSite } from "./AreaIssueSites.js";
import { LetterEvidence } from "./LetterEvidence.js";

type Evidence = AreaLetterDraft["evidence"];
type WorstSite = Evidence["worst_sites"][number];

const WORST_SITES = 5;
const BIN_ISSUES: ReadonlySet<string> = new Set(["waste_dump", "no_bin", "all"]);
const SCORE_NAMES = ["city", "citizen", "bin_access"] as const;

// What an area letter rests on: issue counts, the worst sites and the measured scores, never a withheld one.
export class AreaLetterEvidence {
  readonly #sites: AreaIssueSites;
  readonly #scores: WardScores | null;

  constructor(sites: AreaIssueSites, scores: WardScores | null) {
    this.#sites = sites;
    this.#scores = scores;
  }

  section(): Evidence {
    const counted = this.#sites.counted().map((stored) => stored.site.properties);
    return {
      reports: counted.reduce((total, site) => total + site.report_count, 0),
      reporters: this.#sites.reporters(),
      verified_reports: this.#sites.verifiedReports(),
      sites: counted.length,
      first_reported_at: AreaLetterEvidence.#edge(counted.map((site) => site.first_reported_at), -1),
      last_reported_at: AreaLetterEvidence.#edge(counted.map((site) => site.last_reported_at), 1),
      worst_sites: this.#worst(),
      scores: this.#measuredScores(),
      residents: this.#residents(),
      bin_access: BIN_ISSUES.has(this.#sites.issue) ? this.#binAccess() : null,
    };
  }

  #worst(): Evidence["worst_sites"] {
    const ranked = [...this.#sites.verified()].sort(AreaLetterEvidence.#worse).slice(0, WORST_SITES);
    const [first, ...rest] = ranked.map((stored) => AreaLetterEvidence.#site(stored.site.properties));
    if (first === undefined) {
      throw new InternalDataError("An area letter needs at least one verified site");
    }
    return [first, ...rest];
  }

  #measuredScores(): Evidence["scores"] {
    const row = this.#scores;
    if (row === null) {
      return [];
    }
    const reports = row.counts.verified_reports;
    return SCORE_NAMES.flatMap((name) => {
      const value = row.scores[name].value;
      return value === null ? [] : [{ name, value, verified_reports: reports }];
    });
  }

  // Per site, so one person's notes on two sites count on each; never a note's own words.
  #residents(): Evidence["residents"] {
    const communities = this.#sites
      .verified()
      .flatMap((stored) => (stored.site.properties.community?.people ?? 0) > 0 ? [stored.site.properties.community] : [])
      .filter((community) => community !== undefined && community !== null);
    if (communities.length === 0) {
      return null;
    }
    const mentions = SIGNAL_FLAGS.map((signal) => ({ signal, sites: communities.filter((c) => flagged(c.signals, signal)).length }));
    return {
      sites: communities.length,
      people: communities.reduce((total, community) => total + community.people, 0),
      mentions: mentions.filter((mention) => mention.sites > 0),
    };
  }

  #binAccess(): NonNullable<Evidence["bin_access"]> {
    const measured = this.#sites.verified().map((stored) => stored.site.properties.insights?.no_bin_within_3km);
    return {
      sites_measured: measured.filter((value) => typeof value === "boolean").length,
      sites_without_bin_within_3km: measured.filter((value) => value === true).length,
    };
  }

  static #site(site: Site["properties"]): WorstSite {
    const { site_id, report_type, context, status, report_count, verified_count } = site;
    return {
      site_id,
      report_type,
      context,
      status,
      report_count,
      verified_count,
      first_reported_at: site.first_reported_at,
      last_reported_at: site.last_reported_at,
      photo_urls: site.photo_urls,
      insights: site.insights === undefined || site.insights === null ? null : LetterEvidence.insights(site.insights),
    };
  }

  // Open and reopened sites first, then the most verified reports, then the oldest.
  static #worse(a: StoredAreaSite, b: StoredAreaSite): number {
    const [x, y] = [a.site.properties, b.site.properties];
    const cleaned = Number(x.status === "cleaned") - Number(y.status === "cleaned");
    return cleaned || y.verified_count - x.verified_count || Date.parse(x.first_reported_at) - Date.parse(y.first_reported_at);
  }

  // -1 for the earliest time, 1 for the latest.
  static #edge(times: readonly string[], direction: -1 | 1): string {
    const sorted = [...times].sort((a, b) => direction * (Date.parse(b) - Date.parse(a)));
    const edge = sorted[0];
    if (edge === undefined) {
      throw new InternalDataError("An area letter needs at least one counted site");
    }
    return edge;
  }
}
