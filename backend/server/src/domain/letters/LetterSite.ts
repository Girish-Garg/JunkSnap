import type { Site } from "../../contracts/index.gen.js";
import type { CommunitySignals } from "../notes/Community.js";
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
  // What residents' moderated notes say; null before the first accepted note.
  readonly residents: { readonly people: number; readonly signals: CommunitySignals } | null;
}

export interface LetterSiteProps {
  readonly siteId: string;
  readonly reportType: ReportType;
  readonly context: SiteContext;
  readonly verified: boolean;
  // site.backers.count: people who confirmed it by photo or yes vote, each once (decisions 20261010-1530, -1630).
  readonly backers: number;
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
  readonly backers: number;
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
    this.backers = props.backers;
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
      backers: facts.backers.count,
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
      residents: LetterSite.#residents(facts.community),
    };
  }

  // Never Cc the MP of a seat whose loaded boundary predates a re-delimitation.
  static #currentSeat(seat: LoksabhaSeat): SeatRef | null {
    return seat.status === "outdated" ? null : { id: seat.id, name: seat.name };
  }

  static #residents(community: Facts["community"]): SiteEvidence["residents"] {
    return community === undefined || community === null || community.people < 1
      ? null
      : { people: community.people, signals: community.signals };
  }
}
