import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { validateSite, type Site } from "../../src/contracts/index.gen.js";
import { ExternalServiceError } from "../../src/domain/errors.js";
import { LettersAssembly } from "../../src/handlers/letters/LettersAssembly.js";
import type { Logger } from "../../src/ports/Logger.js";
import type { CountRequest, LetterCounter } from "../../src/ports/letters/LetterCounter.js";
import type { LetterStamp } from "../../src/ports/letters/LetterStamp.js";
import type { LetterBrief, LetterWriter, WrittenLetter } from "../../src/ports/letters/LetterWriter.js";
import type { SiteReader } from "../../src/ports/letters/SiteReader.js";
import type { LetterCounters } from "../../src/services/letters/LetterRateLimiter.js";
import type { LetterService } from "../../src/services/letters/LetterService.js";

export const FIXTURE_RULES_DIR = fileURLToPath(new URL("./fixtures/rules/", import.meta.url));
export const REAL_RULES_DIR = fileURLToPath(new URL("../../../../data/rules/", import.meta.url));
export const DEVICE = "3f6c2a1e-8b4d-4c7a-9e21-5d0b7f3a6c14";
export const MODEL = { provider: "bedrock", model: "global.anthropic.claude-sonnet-4-6", version: "4.6" } as const;

type Properties = Site["properties"];
type Location = Properties["location"];

export function siteFixture(name: string): Site {
  const url = new URL(`../../../../contracts/fixtures/site.${name}.json`, import.meta.url);
  return validateSite(JSON.parse(readFileSync(url, "utf8")));
}

export function siteWith(base: Site, patch: Partial<Properties>, location: Partial<Location> = {}): Site {
  const properties = { ...base.properties, ...patch };
  return { ...base, properties: { ...properties, location: { ...properties.location, ...location } } };
}

// Test-owned seats, so fixture corrections in contracts/ do not move these expectations.
const WARD_LOCATION: Location = {
  state: "Rajasthan",
  district: { id: "rajasthan-jodhpur", name: "Jodhpur" },
  town: "Jodhpur",
  local_body: { id: "jodhpur-mc", name: "Jodhpur Municipal Corporation", head_office: "Commissioner" },
  ward: { id: "jodhpur-mc-w37", name: "Ward 37" },
  assembly_seat: { id: "s20-ac-127", name: "Sardarpura" },
  loksabha_seat: { id: "s20-pc-16", name: "Jodhpur", status: "current" },
  representatives: [
    { office: "councillor", seat_id: "jodhpur-mc-w37", as_of: "2026-10-01", source: "https://lsg.rajasthan.gov.in/" },
    { office: "mla", seat_id: "s20-ac-127", as_of: "2026-10-01", source: "https://eci.gov.in/" },
    { office: "mp", seat_id: "s20-pc-16", as_of: "2026-10-01", source: "https://sansad.in/ls" },
  ],
};

// The jdh-1 waste dump on a vacant plot, placed in a ward with all three seats represented.
export function wardSite(location: Partial<Location> = {}): Site {
  return siteWith(siteFixture("jdh-1"), {}, { ...WARD_LOCATION, ...location });
}

export class FakeSites implements SiteReader {
  readonly #sites: readonly Site[];

  constructor(sites: readonly Site[]) {
    this.#sites = sites;
  }

  async find(siteId: string): Promise<Site | null> {
    return this.#sites.find((site) => site.properties.site_id === siteId) ?? null;
  }
}

// Same windowed rule as the DynamoDB counter: reset once windowMs has passed since the window start.
export class MemoryCounter implements LetterCounter {
  readonly taken: string[] = [];
  readonly #windows = new Map<string, { start: number; count: number }>();

  async fits(request: CountRequest): Promise<boolean> {
    return this.#current(request).count < request.limit;
  }

  async take(request: CountRequest): Promise<boolean> {
    const window = this.#current(request);
    if (window.count >= request.limit) {
      return false;
    }
    this.#windows.set(request.key, { start: window.start, count: window.count + 1 });
    this.taken.push(request.key);
    return true;
  }

  #current(request: CountRequest): { start: number; count: number } {
    const now = request.now.getTime();
    const window = this.#windows.get(request.key);
    return window === undefined || now - window.start >= request.windowMs ? { start: now, count: 0 } : window;
  }
}

export function memoryCounters(): LetterCounters & { devices: MemoryCounter; users: MemoryCounter } {
  return { devices: new MemoryCounter(), users: new MemoryCounter() };
}

export class FakeWriter implements LetterWriter {
  readonly briefs: LetterBrief[] = [];
  readonly #reply: (brief: LetterBrief) => WrittenLetter;

  constructor(reply: (brief: LetterBrief) => WrittenLetter) {
    this.#reply = reply;
  }

  async write(brief: LetterBrief): Promise<WrittenLetter> {
    this.briefs.push(brief);
    return this.#reply(brief);
  }
}

export function quotingWriter(
  change: (quote: string) => string = (quote) => quote,
  subject = "Request to clear a waste site",
): FakeWriter {
  return new FakeWriter((brief) => {
    const quotes = brief.citations.map((citation) => `${citation.clause} says "${change(citation.quote)}".`);
    const body = `To the ${brief.addressees.to.office}.\n\nResidents report a dump.\n\n${quotes.join("\n")}`;
    return { subject, body, provenance: MODEL };
  });
}

// Every provider failed, as the router reports it.
export function downWriter(): FakeWriter {
  return new FakeWriter(() => {
    throw new ExternalServiceError("no LLM provider gave a usable answer for task letters");
  });
}

export class FixedStamp implements LetterStamp {
  #now: Date;

  constructor(now = "2026-10-10T08:00:00.000Z") {
    this.#now = new Date(now);
  }

  now(): Date {
    return this.#now;
  }

  letterId(): string {
    return "ltr_test_1";
  }

  advance(ms: number): void {
    this.#now = new Date(this.#now.getTime() + ms);
  }
}

export class RecordingLogger implements Logger {
  readonly warnings: string[] = [];

  info(): void {}

  warn(first: object | string, message?: string): void {
    this.warnings.push(typeof first === "string" ? first : (message ?? ""));
  }

  error(): void {}
}

export interface ServiceParts {
  readonly sites: readonly Site[];
  readonly writer?: LetterWriter;
  readonly counters?: LetterCounters;
  readonly stamp?: LetterStamp;
  readonly logger?: Logger;
  readonly rulesDir?: string;
}

export async function letterService(parts: ServiceParts): Promise<LetterService> {
  const assembly = new LettersAssembly(parts.rulesDir ?? FIXTURE_RULES_DIR, parts.logger ?? new RecordingLogger());
  return assembly.service({
    sites: new FakeSites(parts.sites),
    counters: parts.counters ?? memoryCounters(),
    writer: parts.writer ?? quotingWriter(),
    stamp: parts.stamp ?? new FixedStamp(),
  });
}
