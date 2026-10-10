import type { FlagAuthor, FlagReason, FlagText, StoredPhotoFlag } from "../../src/domain/flags/PhotoFlag.js";
import type { NoteVerdict } from "../../src/domain/moderation/types.js";
import { authorHash } from "../../src/domain/notes/AuthorHash.js";
import { GeoPoint } from "../../src/domain/sites/GeoPoint.js";
import type { MergeableReport } from "../../src/domain/sites/MergeableReport.js";
import { Site } from "../../src/domain/sites/Site.js";
import type { CommunityTrigger, PhotoFlagStore } from "../../src/ports/flags/PhotoFlagStore.js";
import type { NoteModerator } from "../../src/ports/moderation/NoteModerator.js";
import { PhotoFlagService, type FlagRequest } from "../../src/services/flags/PhotoFlagService.js";
import { LetterRateLimiter } from "../../src/services/letters/LetterRateLimiter.js";
import { ConflictRetry } from "../../src/services/sites/ConflictRetry.js";
import { memoryCounters } from "../letters/support.js";
import { BASE_LAT, BASE_LON, DEVICE_A, DEVICE_B, northOf, report } from "../sites/builders.js";
import { FakeSiteRepository, FixedClock } from "../sites/fakes.js";
import { FakeSiteReports } from "../sites/withdrawalFakes.js";

export const SITE = "site_jdh_1";
export const FIRST_PHOTO = "rpt_jdh_1";
export const SECOND_PHOTO = "rpt_jdh_1b";
export const CLEAN: NoteVerdict = { result: "clean", reasons: [], provider: "bedrock", model: "apac.anthropic.claude-haiku-4-5", version: "v1:0" };
export const REMOVED: NoteVerdict = { ...CLEAN, result: "removed", reasons: ["personal_data"] };

// The notes table's flag rows: one per site, photo and author, overwritten by the latest report.
export class MemoryFlags implements PhotoFlagStore {
  readonly rows = new Map<string, StoredPhotoFlag>();

  async put(flag: StoredPhotoFlag): Promise<void> {
    this.rows.set(`${flag.siteId}#${flag.photoId}#${flag.authorHash}`, flag);
  }

  async authorsOf(siteId: string, photoId: string): Promise<FlagAuthor[]> {
    return [...this.rows.values()].filter((row) => row.siteId === siteId && row.photoId === photoId);
  }

  async textsFor(siteId: string): Promise<FlagText[]> {
    return [...this.rows.values()].filter((row) => row.siteId === siteId).map((row) => ({ photoId: row.photoId, author: row, text: row.text }));
  }
}

export class FakeModerator implements NoteModerator {
  readonly seen: string[] = [];
  verdict: NoteVerdict = CLEAN;

  async review(note: string): Promise<NoteVerdict> {
    this.seen.push(note);
    return this.verdict;
  }
}

export class RecordingTrigger implements CommunityTrigger {
  readonly sites: string[] = [];

  textAccepted(siteId: string): void {
    this.sites.push(siteId);
  }
}

// The i-th neighbour who reports a photo: their own user id and device.
export function flagger(i: number): { readonly userId: string; readonly deviceToken: string } {
  return { userId: `user-flagger-${i}`, deviceToken: `00000000-0000-4000-8000-${String(i).padStart(12, "0")}` };
}

export interface FlagRig {
  readonly service: PhotoFlagService;
  readonly sites: FakeSiteRepository;
  readonly rows: FakeSiteReports;
  readonly flags: MemoryFlags;
  readonly moderator: FakeModerator;
  readonly community: RecordingTrigger;
}

export function flagRig(limit = 10, flags = new MemoryFlags()): FlagRig {
  const parts = { sites: new FakeSiteRepository(), rows: new FakeSiteReports(), flags };
  const checks = { moderator: new FakeModerator(), community: new RecordingTrigger() };
  const limiter = new LetterRateLimiter(memoryCounters(), limit, "photo reports");
  const service = new PhotoFlagService({ ...parts, ...checks, limiter, clock: new FixedClock(), retry: new ConflictRetry() });
  return { service, ...parts, ...checks };
}

// Founds site_jdh_1 from DEVICE_A's photo; with second, DEVICE_B's photo 10 m north joins it.
export function seeded(rig: FlagRig, second = false): Site {
  const founder = report({ device: DEVICE_A });
  const site = Site.found(founder);
  rig.rows.add(SITE, founder);
  if (second) {
    const added: MergeableReport = { ...report({ id: "jdh_1b", device: DEVICE_B, lat: northOf(10), capturedAt: "2026-10-10T03:00:00Z" }), brands: [] };
    site.merge(added);
    rig.rows.add(SITE, added);
  }
  rig.sites.put(site);
  return site;
}

interface FlagOptions {
  readonly photo?: string;
  readonly reason?: FlagReason;
  readonly text?: string | null;
  // Where the resident stands; the site itself unless a test moves them.
  readonly point?: GeoPoint;
}

export function request(person: { readonly userId: string; readonly deviceToken: string }, options: FlagOptions = {}): FlagRequest {
  return {
    siteId: SITE,
    photoId: options.photo ?? FIRST_PHOTO,
    reason: options.reason ?? "unrelated",
    text: options.text ?? null,
    requester: person,
    point: options.point ?? new GeoPoint(BASE_LAT, BASE_LON),
    authorHash: authorHash(person.userId),
    deviceHash: authorHash(person.deviceToken),
  };
}

// Reports the photo once from each of people first..last.
export async function flagBy(rig: FlagRig, first: number, last: number, photo = FIRST_PHOTO): Promise<void> {
  for (let i = first; i <= last; i += 1) {
    await rig.service.flag(request(flagger(i), { photo }));
  }
}
