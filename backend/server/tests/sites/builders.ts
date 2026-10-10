import { readFileSync } from "node:fs";
import type {
  BrandLabel,
  LocationLookup,
  ModerationResult,
  ReportUpload,
  VerificationResult,
} from "../../src/contracts/index.gen.js";
import type { MergeableReport, MergeEvidence } from "../../src/domain/sites/MergeableReport.js";
import type { Site } from "../../src/domain/sites/Site.js";
import type { AfterPhoto } from "../../src/domain/sites/SiteCleanup.js";
import { VoteTally } from "../../src/domain/sites/VoteTally.js";
import { MergeableReportFactory } from "../../src/domain/sites/MergeableReportFactory.js";
import { PublicMedia } from "../../src/domain/sites/PublicMedia.js";
import { UNMEASURED, type BinMeasure } from "../../src/domain/bins/KnownBin.js";
import { expiryOf } from "../../src/domain/SiteExpiry.js";
import type {
  NearPlace,
  ReportContext,
  ReportInsights,
  ReportType,
  SiteFeature,
} from "../../src/domain/sites/SiteTypes.js";

const FIXTURES = new URL("../../../../contracts/fixtures/", import.meta.url);

export const BASE_URL = "https://d111111abcdef8.cloudfront.net";
export const DEVICE_A = "3f6c2a1e-8b4d-4c7a-9e21-5d0b7f3a6c14";
export const DEVICE_B = "a71e5c90-2d3b-4f86-b1c4-9e0d27f58a63";
export const DEVICE_C = "5b1d3c2e-7f4a-4e6b-8c9d-0a1b2c3d4e5f";
export const DEVICE_D = "9c8b7a6d-5e4f-4a3b-9c1d-2e3f4a5b6c7d";
// The jdh-1 report's GPS.
export const BASE_LAT = 26.26183;
export const BASE_LON = 73.00352;
const METRES_PER_DEGREE_LAT = 111_320;

export function fixture<T>(name: string): T {
  return JSON.parse(readFileSync(new URL(name, FIXTURES), "utf8")) as T;
}

export function siteFixture(sample: string): SiteFeature {
  return fixture<SiteFeature>(`site.${sample}.json`);
}

// The Feature the api shows for a stored site: a row without expires_at shows 90 days after its last report.
export function shown(feature: SiteFeature): SiteFeature {
  return { ...feature, properties: { ...feature.properties, expires_at: expiryOf(feature.properties) } };
}

export function northOf(metres: number): number {
  return BASE_LAT + metres / METRES_PER_DEGREE_LAT;
}

export interface EvidenceOptions {
  readonly id?: string;
  readonly lat?: number;
  readonly lon?: number;
  readonly decision?: "auto_verified" | "community_check";
  readonly reportType?: ReportType;
  readonly context?: ReportContext;
  readonly device?: string;
  readonly meToo?: string;
  readonly embeddingKey?: string | null;
  readonly capturedAt?: string;
  readonly burning?: boolean;
  readonly user?: string | null;
  readonly insights?: ReportInsights | null;
  readonly near?: readonly NearPlace[];
  readonly bin?: BinMeasure;
}

// Each device belongs to its own user unless a test says otherwise.
export function userOf(device: string): string {
  return `user-${device.slice(0, 8)}`;
}

const BURNING = {
  hazard: "burning",
  confidence: 0.9,
  source: { signal: "vision_judge", provider: "bedrock", model: "global.anthropic.claude-sonnet-4-6", version: "4.6" },
} as const;

function insightsOf(o: EvidenceOptions, fromFixture: ReportInsights | null): ReportInsights | null {
  const insights = o.insights === undefined ? fromFixture : o.insights;
  return insights !== null && o.burning === true ? { ...insights, hazards: [BURNING] } : insights;
}

const DEFAULTS = {
  id: "jdh_1",
  lat: BASE_LAT,
  lon: BASE_LON,
  decision: "auto_verified",
  reportType: "waste_dump",
  context: "vacant_plot",
  device: DEVICE_A,
  embeddingKey: null,
  capturedAt: "2026-10-10T02:14:05Z",
  near: [],
  bin: UNMEASURED,
} as const;

// A jdh-1 report from the fixtures, with the fields a test changes.
// A photo report always has both results; no-bin reports without them are built by the zone tests.
export type PhotoEvidence = MergeEvidence & { readonly moderation: ModerationResult; readonly verification: VerificationResult };

export function evidence(options: EvidenceOptions = {}): PhotoEvidence {
  const o = { ...DEFAULTS, ...options };
  const upload = fixture<ReportUpload>("report_upload.jdh-1.json");
  const moderation = fixture<ModerationResult>("moderation_result.jdh-1.json");
  const verification = fixture<VerificationResult>("verification_result.jdh-1.json");
  const meToo = o.meToo === undefined ? {} : { me_too_site_id: o.meToo };
  const user = o.user === undefined ? userOf(o.device) : o.user;
  const guestUpload: ReportUpload = { ...upload };
  delete guestUpload.user_id;
  return {
    upload: {
      ...guestUpload,
      ...meToo,
      ...(user === null ? {} : { user_id: user }),
      upload_id: `upl_${o.id}`,
      report_type: o.reportType,
      context: o.context,
      gps: { ...upload.gps, lat: o.lat, lon: o.lon },
      device_token: o.device,
      captured_at: o.capturedAt,
    },
    bin: o.bin,
    moderation: { ...moderation, report_id: `rpt_${o.id}`, blurred_key: `media/reports/rpt_${o.id}.jpg` },
    verification: {
      ...verification,
      report_id: `rpt_${o.id}`,
      decision: o.decision,
      embedding_key: o.embeddingKey,
      insights: insightsOf(o, verification.insights ?? null),
    },
    location: fixture<LocationLookup>("location_lookup.jdh-1.json"),
    near: o.near,
    brands: [fixture<BrandLabel>("brand_label.jdh-1.json")],
  };
}

export function report(options: EvidenceOptions = {}): MergeableReport {
  return new MergeableReportFactory(new PublicMedia(BASE_URL)).create(evidence(options));
}

export const NO_VOTES = VoteTally.of([]);

// One person's after-photo that the models passed (decision 20261010-1855).
export function afterPhoto(person: string, at: string, cleanupId = `cln_${person}`): AfterPhoto {
  return { cleanupId, photoUrl: `${BASE_URL}/media/cleanups/${cleanupId}.jpg`, person, at };
}

// Sends and accepts one person's after-photo at the given time.
export function acceptPhoto(site: Site, photo: AfterPhoto, votes: VoteTally = NO_VOTES): void {
  site.startCleanup(photo.cleanupId, new Date(photo.at));
  site.acceptCleanup(photo, votes);
}

// Three different people's after-photos: the quorum that clears a site; the last photo is cln_cleaner-3.
export function clearByPhotos(site: Site, at: string): void {
  for (const person of ["cleaner-1", "cleaner-2", "cleaner-3"]) {
    acceptPhoto(site, afterPhoto(person, at));
  }
}
