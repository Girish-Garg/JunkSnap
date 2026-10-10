import type { Site, WardScores } from "../../src/contracts/index.gen.js";
import type { AreaKey } from "../../src/domain/AreaKey.js";
import { ExternalServiceError } from "../../src/domain/errors.js";
import type { StoredAreaSite } from "../../src/domain/letters/AreaIssueSites.js";
import { LettersAssembly } from "../../src/handlers/letters/LettersAssembly.js";
import type { Logger } from "../../src/ports/Logger.js";
import type { AreaLetterBrief, AreaLetterWriter } from "../../src/ports/letters/AreaLetterWriter.js";
import type { AreaLetterSites, AreaSiteBatch } from "../../src/ports/letters/AreaLetterSites.js";
import type { LetterStamp } from "../../src/ports/letters/LetterStamp.js";
import type { WrittenLetter } from "../../src/ports/letters/LetterWriter.js";
import type { AreaLetterService } from "../../src/services/letters/AreaLetterService.js";
import type { LetterCounters } from "../../src/services/letters/LetterRateLimiter.js";
import {
  DEVICE,
  FIXTURE_RULES_DIR,
  FixedStamp,
  memoryCounters,
  MODEL,
  RecordingLogger,
  siteFixture,
  siteWith,
  USER,
  wardSite,
} from "./support.js";

type Properties = Site["properties"];

export const ASSEMBLY = "s20-ac-127";

// A site in the test ward and assembly seat, with its own id, counts and reporters.
export function areaSite(id: string, patch: Partial<Properties> = {}, reporterIds: string[] | null = [`dev-${id}`]): StoredAreaSite {
  return { site: siteWith(wardSite(), { site_id: `site_${id}`, ...patch }), reporterIds };
}

// A verified no-bin place: within is site.insights.no_bin_within_3km (null when bins are not mapped there).
export function noBinSite(id: string, verified: number, reporters: number, within: boolean | null): StoredAreaSite {
  const base = wardSite().properties.insights;
  const insights = base === undefined ? undefined : { ...base, nearest_bin: null, no_bin_within_3km: within };
  const patch = { report_type: "no_bin", context: "no_pickup", verified_count: verified, report_count: verified, reporters, insights } as const;
  return areaSite(id, patch);
}

// Three waste dumps (12 verified reports), a rejected dump, an eligible no-bin place (3) and a dump in another seat.
export function assemblySites(): StoredAreaSite[] {
  return [
    areaSite("a1", { verified_count: 6, report_count: 7, first_reported_at: "2026-10-08T05:10:00Z" }, ["u1", "u2", "u3"]),
    areaSite("a2", { verified_count: 4, report_count: 4, status: "cleaned", cleaned_at: "2026-10-10T01:00:00Z" }, ["u2", "u4"]),
    areaSite("a3", { verified_count: 2, report_count: 3, last_reported_at: "2026-10-10T06:00:00Z" }, null),
    areaSite("a4", { verification: "rejected", verified_count: 0, report_count: 2 }),
    noBinSite("b1", 3, 6, true),
    { site: siteWith(siteFixture("jpr-1"), { site_id: "site_far_9", verification: "verified", verified_count: 9 }), reporterIds: [] },
  ];
}

export class FakeAreaSites implements AreaLetterSites {
  readonly #sites: readonly StoredAreaSite[];
  readonly #unreadable: number;

  readonly #onRead: () => void;

  constructor(sites: readonly StoredAreaSite[], unreadable = 0, onRead: () => void = () => {}) {
    this.#sites = sites;
    this.#unreadable = unreadable;
    this.#onRead = onRead;
  }

  // The real adapter filters in DynamoDB; the domain filters again, so this returns everything.
  async sitesIn(): Promise<AreaSiteBatch> {
    this.#onRead();
    return { sites: this.#sites, unreadable: this.#unreadable };
  }
}

export class FakeScores {
  readonly #rows: ReadonlyMap<string, WardScores>;

  constructor(rows: Record<string, WardScores> = {}) {
    this.#rows = new Map(Object.entries(rows));
  }

  async find(area: AreaKey): Promise<WardScores | null> {
    return this.#rows.get(area.toString()) ?? null;
  }
}

export class FakeAreaWriter implements AreaLetterWriter {
  readonly briefs: AreaLetterBrief[] = [];
  readonly #reply: (brief: AreaLetterBrief) => WrittenLetter;

  constructor(reply: (brief: AreaLetterBrief) => WrittenLetter) {
    this.#reply = reply;
  }

  async write(brief: AreaLetterBrief): Promise<WrittenLetter> {
    this.briefs.push(brief);
    return this.#reply(brief);
  }
}

export function quotingAreaWriter(extra = ""): FakeAreaWriter {
  return new FakeAreaWriter((brief) => {
    const quotes = brief.citations.map((citation) => `${citation.clause}: "${citation.quote}"`).join("\n\n");
    return { subject: "Request about waste sites in this area", body: `Residents report waste sites.\n\n${quotes}\n\n${extra}`, provenance: MODEL };
  });
}

export function downAreaWriter(): FakeAreaWriter {
  return new FakeAreaWriter(() => {
    throw new ExternalServiceError("no LLM provider gave a usable answer for task letters");
  });
}

export interface AreaServiceParts {
  readonly sites?: readonly StoredAreaSite[];
  readonly unreadable?: number;
  readonly onRead?: () => void;
  readonly scores?: FakeScores;
  readonly writer?: AreaLetterWriter;
  readonly counters?: LetterCounters;
  readonly stamp?: LetterStamp;
  readonly logger?: Logger;
  readonly rulesDir?: string;
}

export async function areaLetterService(parts: AreaServiceParts = {}): Promise<AreaLetterService> {
  const all = {
    rulesDir: FIXTURE_RULES_DIR,
    logger: new RecordingLogger(),
    sites: assemblySites(),
    scores: new FakeScores(),
    counters: memoryCounters(),
    writer: downAreaWriter(),
    stamp: new FixedStamp(),
    ...parts,
  };
  return new LettersAssembly(all.rulesDir, all.logger).areaService({
    sites: new FakeAreaSites(all.sites, all.unreadable, all.onRead),
    scores: all.scores,
    counters: all.counters,
    writer: all.writer,
    stamp: all.stamp,
  });
}

export const REQUESTER = { deviceToken: DEVICE, userId: USER };
