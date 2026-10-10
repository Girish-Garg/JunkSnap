import type { Site } from "../../contracts/index.gen.js";
import { SitePlace } from "./SitePlace.js";
import { Situation } from "./Situation.js";
import type { ReportType, SeatRef, SiteContext } from "./types.js";

type Location = Site["properties"]["location"];
type LoksabhaSeat = Location["loksabha_seat"];
type Facts = Site["properties"];
export type SiteInsights = NonNullable<Facts["insights"]>;
export type NearestBin = NonNullable<SiteInsights["nearest_bin"]>;

export interface SiteEvidence {
  readonly lat: number;
  readonly lon: number;
  readonly reportCount: number;
  readonly verifiedCount: number;
  // Null on sites from before reporters were counted.
  readonly reporters: number | null;
  readonly firstReportedAt: string;
  readonly lastReportedAt: string;
  readonly photoUrls: Facts["photo_urls"];
  readonly insights: SiteInsights | null;
  readonly nearestBin: NearestBin | null;
  // Null when bins were never measured for this site.
  readonly noBinWithin3km: boolean | null;
}

export interface LetterSiteProps {
  readonly siteId: string;
  readonly reportType: ReportType;
  readonly context: SiteContext;
  readonly verified: boolean;
  readonly burning: boolean;
  readonly hazards: readonly string[];
  readonly packaging: boolean;
  readonly place: SitePlace;
  readonly evidence: SiteEvidence;
}

export class LetterSite {
  readonly siteId: string;
  readonly reportType: ReportType;
  readonly context: SiteContext;
  readonly verified: boolean;
  readonly burning: boolean;
  readonly hazards: readonly string[];
  readonly packaging: boolean;
  readonly place: SitePlace;
  readonly evidence: SiteEvidence;

  constructor(props: LetterSiteProps) {
    this.siteId = props.siteId;
    this.reportType = props.reportType;
    this.context = props.context;
    this.verified = props.verified;
    this.burning = props.burning;
    this.hazards = props.hazards;
    this.packaging = props.packaging;
    this.place = props.place;
    this.evidence = props.evidence;
  }

  static fromSite(site: Site): LetterSite {
    const facts = site.properties;
    const [lon, lat] = site.geometry.coordinates;
    return new LetterSite({
      siteId: facts.site_id,
      reportType: facts.report_type,
      context: facts.context,
      verified: facts.verification === "verified",
      burning: facts.burning,
      hazards: (facts.insights?.hazards ?? []).map((entry) => entry.hazard),
      packaging: facts.brands.length > 0,
      place: LetterSite.#place(facts.location),
      evidence: LetterSite.#evidence(facts, lat, lon),
    });
  }

  situation(): Situation {
    return Situation.of(this);
  }

  static #place(location: Location): SitePlace {
    const body = location.local_body;
    return new SitePlace({
      state: location.state,
      district: location.district,
      town: location.town,
      localBody: body === null ? null : { id: body.id, name: body.name, headOffice: body.head_office },
      ward: location.ward,
      assemblySeat: location.assembly_seat,
      loksabhaSeat: LetterSite.#currentSeat(location.loksabha_seat),
      representatives: location.representatives.map((row) => ({ office: row.office, seatId: row.seat_id })),
    });
  }

  static #evidence(facts: Facts, lat: number, lon: number): SiteEvidence {
    const insights = facts.insights ?? null;
    return {
      lat,
      lon,
      reportCount: facts.report_count,
      verifiedCount: facts.verified_count,
      reporters: facts.reporters ?? null,
      firstReportedAt: facts.first_reported_at,
      lastReportedAt: facts.last_reported_at,
      photoUrls: facts.photo_urls,
      insights,
      nearestBin: insights?.nearest_bin ?? null,
      noBinWithin3km: insights?.no_bin_within_3km ?? null,
    };
  }

  // Never Cc the MP of a seat whose loaded boundary predates a re-delimitation.
  static #currentSeat(seat: LoksabhaSeat): SeatRef | null {
    return seat.status === "outdated" ? null : { id: seat.id, name: seat.name };
  }
}
