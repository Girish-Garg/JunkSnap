import type { WardScores } from "../../src/contracts/index.gen.js";
import { NgeohashCells } from "../../src/adapters/sites/NgeohashCells.js";
import type { CleanupFinish, CleanupRecord } from "../../src/domain/sites/Cleanup.js";
import type { EmbeddingVector } from "../../src/domain/sites/EmbeddingVector.js";
import { Site } from "../../src/domain/sites/Site.js";
import { StaleSiteError } from "../../src/domain/sites/SiteErrors.js";
import type { SiteFeature, SiteInternals, SiteState, Verification } from "../../src/domain/sites/SiteTypes.js";
import type { Vote } from "../../src/domain/sites/VoteTally.js";
import type { Logger } from "../../src/ports/Logger.js";
import type { AreaScoreSeeder } from "../../src/ports/sites/AreaScoreSeeder.js";
import type { CleanupQueue } from "../../src/ports/sites/CleanupQueue.js";
import type { CleanupRepository } from "../../src/ports/sites/CleanupRepository.js";
import type { Clock } from "../../src/ports/sites/Clock.js";
import type { EmbeddingStore } from "../../src/ports/sites/EmbeddingStore.js";
import type { ReportStatusWriter } from "../../src/ports/sites/ReportStatusWriter.js";
import type { SiteRepository } from "../../src/ports/sites/SiteRepository.js";
import type { VoteRepository } from "../../src/ports/sites/VoteRepository.js";

export const NOW = "2026-10-10T06:00:00.000Z";

export class RecordingLogger implements Logger {
  readonly lines: { readonly level: string; readonly fields: object; readonly message: string }[] = [];

  info(fields: object | string, message?: string): void {
    this.#record("info", fields, message);
  }

  warn(fields: object | string, message?: string): void {
    this.#record("warn", fields, message);
  }

  error(fields: object | string, message?: string): void {
    this.#record("error", fields, message);
  }

  #record(level: string, fields: object | string, message?: string): void {
    const entry = typeof fields === "string" ? { fields: {}, message: fields } : { fields, message: message ?? "" };
    this.lines.push({ level, ...entry });
  }
}

export class FixedClock implements Clock {
  now(): Date {
    return new Date(NOW);
  }
}

// Same contract as DynamoSiteRepository: versioned saves, conditional creates, cell queries.
export class FakeSiteRepository implements SiteRepository {
  readonly #states = new Map<string, SiteState>();
  readonly #cells = new NgeohashCells();
  #staleSaves = 0;
  saves = 0;

  async get(siteId: string): Promise<Site | null> {
    const state = this.#states.get(siteId);
    return state === undefined ? null : Site.restore(state);
  }

  async inCell(cell: string): Promise<Site[]> {
    const sites = [...this.#states.values()].map((state) => Site.restore(state));
    return sites.filter((site) => this.#cells.cellOf(site.point) === cell);
  }

  async allIds(): Promise<string[]> {
    return [...this.#states.keys()];
  }

  async create(site: Site): Promise<boolean> {
    if (this.#states.has(site.siteId)) {
      return false;
    }
    this.#store(site);
    return true;
  }

  async save(site: Site): Promise<void> {
    const current = this.#states.get(site.siteId);
    if (this.#staleSaves > 0 || current?.internals.version !== site.version) {
      this.#staleSaves = Math.max(0, this.#staleSaves - 1);
      throw new StaleSiteError(`${site.siteId} is stale`);
    }
    this.saves += 1;
    this.#store(site);
  }

  // Seeds a site as if it had been saved once.
  put(site: Site): void {
    this.#store(site);
  }

  putFeature(feature: SiteFeature, internals: Partial<SiteInternals> = {}): void {
    const base = {
      reports: [],
      reporterDevices: [],
      reporterUsers: [],
      reporterIds: [],
      yesVoters: [],
      noVoters: [],
      needsBackerCount: false,
      verifiedBackers: null,
      meTooCount: 0,
      embeddingKey: null,
      pendingCleanupId: null,
    };
    this.#states.set(feature.properties.site_id, { feature, internals: { ...base, version: 1, ...internals } });
  }

  failNextSaves(count: number): void {
    this.#staleSaves = count;
  }

  feature(siteId: string): SiteFeature {
    const state = this.#states.get(siteId);
    if (state === undefined) {
      throw new Error(`no site ${siteId}`);
    }
    return state.feature;
  }

  internals(siteId: string): SiteInternals | undefined {
    return this.#states.get(siteId)?.internals;
  }

  count(): number {
    return this.#states.size;
  }

  #store(site: Site): void {
    const { feature, internals } = site.snapshot();
    this.#states.set(site.siteId, { feature, internals: { ...internals, version: internals.version + 1 } });
  }
}

export class FakeVoteRepository implements VoteRepository {
  readonly #votes = new Map<string, Vote>();

  async put(vote: Vote): Promise<void> {
    this.#votes.set(`${vote.siteId} ${vote.deviceToken}`, vote);
  }

  async forSite(siteId: string): Promise<Vote[]> {
    return [...this.#votes.values()].filter((vote) => vote.siteId === siteId);
  }
}

export class FakeReportStatus implements ReportStatusWriter {
  readonly statuses = new Map<string, Verification>();
  calls = 0;
  #failures = 0;

  failNext(): void {
    this.#failures += 1;
  }

  async followSite(reportIds: readonly string[], status: Verification): Promise<void> {
    this.calls += 1;
    if (this.#failures > 0) {
      this.#failures -= 1;
      throw new Error("reports table unreachable");
    }
    for (const reportId of reportIds) {
      this.statuses.set(reportId, status);
    }
  }
}

export class FakeScoreSeeder implements AreaScoreSeeder {
  readonly rows = new Map<string, WardScores>();
  readonly within = new Map<string, readonly string[]>();

  async seedIfMissing(row: WardScores, within: readonly string[]): Promise<void> {
    const key = `${row.area.kind}/${row.area.id}`;
    if (!this.rows.has(key)) {
      this.rows.set(key, row);
      this.within.set(key, within);
    }
  }
}

export class FakeEmbeddings implements EmbeddingStore {
  readonly #vectors = new Map<string, EmbeddingVector>();
  reads = 0;

  add(key: string, vector: EmbeddingVector): void {
    this.#vectors.set(key, vector);
  }

  async vectorAt(key: string): Promise<EmbeddingVector> {
    this.reads += 1;
    const vector = this.#vectors.get(key);
    if (vector === undefined) {
      throw new Error(`no embedding ${key}`);
    }
    return vector;
  }
}

export class FakeCleanups implements CleanupRepository {
  readonly records = new Map<string, CleanupRecord>();
  readonly finished = new Map<string, CleanupFinish>();

  async get(cleanupId: string): Promise<CleanupRecord | null> {
    return this.records.get(cleanupId) ?? null;
  }

  async create(record: CleanupRecord): Promise<void> {
    if (!this.records.has(record.cleanup_id)) {
      this.records.set(record.cleanup_id, record);
    }
  }

  async finish(cleanupId: string, result: CleanupFinish): Promise<void> {
    const record = this.records.get(cleanupId);
    if (record?.status === "checking") {
      this.records.set(cleanupId, { ...record, status: result.status });
      this.finished.set(cleanupId, result);
    }
  }
}

export class FakeQueue implements CleanupQueue {
  readonly sent: CleanupRecord[] = [];

  async send(record: CleanupRecord): Promise<void> {
    this.sent.push(record);
  }
}
