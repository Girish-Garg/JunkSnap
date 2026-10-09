import { readFileSync } from "node:fs";
import type {
  BrandLabel,
  LocationLookup,
  ModerationResult,
  ReportUpload,
  VerificationResult,
} from "../src/contracts/index.gen.js";
import { ConcurrentUpdateError } from "../src/domain/ConcurrentUpdateError.js";
import { Report } from "../src/domain/Report.js";
import type { MergeOutcome, ReportModerationRequest, ReportRecord } from "../src/domain/ReportRecord.js";
import type { VerifyRequest } from "../src/domain/VerifyRequest.js";
import type { BrandReader, BrandReadRequest } from "../src/ports/BrandReader.js";
import type { Clock } from "../src/ports/Clock.js";
import type { MlVerifyClient } from "../src/ports/MlVerifyClient.js";
import type { ReportLocator } from "../src/ports/ReportLocator.js";
import type { ReportMerger } from "../src/ports/ReportMerger.js";
import type { ReportModerator } from "../src/ports/ReportModerator.js";
import type { ReportQueue } from "../src/ports/ReportQueue.js";
import type { ReportRepository } from "../src/ports/ReportRepository.js";
import type { ReputationReader } from "../src/ports/ReputationReader.js";
import type { SnapCounter } from "../src/ports/SnapCounter.js";

const CONTRACTS = new URL("../../../contracts/", import.meta.url);

export function fixture<T>(name: string): T {
  return JSON.parse(readFileSync(new URL(`fixtures/${name}.json`, CONTRACTS), "utf8")) as T;
}

export const upload = (): ReportUpload => fixture<ReportUpload>("report_upload.jdh-1");
export const moderation = (): ModerationResult => fixture<ModerationResult>("moderation_result.jdh-1");
export const verification = (): VerificationResult => fixture<VerificationResult>("verification_result.jdh-1");
export const OTHER_DEVICE = "9b2d7c4e-1f3a-4e8b-a6c5-0d4e8f2b7a91";

export class FixedClock implements Clock {
  #current: Date;

  constructor(iso: string) {
    this.#current = new Date(iso);
  }

  now(): Date {
    return new Date(this.#current);
  }

  advance(ms: number): void {
    this.#current = new Date(this.#current.getTime() + ms);
  }
}

export class FakeReportRepository implements ReportRepository {
  readonly records = new Map<string, ReportRecord>();
  readonly saved: ReportRecord[] = [];

  async get(reportId: string): Promise<Report | undefined> {
    const record = this.records.get(reportId);
    return record === undefined ? undefined : Report.fromRecord(record);
  }

  async create(report: Report): Promise<boolean> {
    if (this.records.has(report.id)) {
      return false;
    }
    this.#write(report);
    return true;
  }

  // Same optimistic lock as DynamoReportRepository.
  async save(report: Report): Promise<void> {
    if ((this.records.get(report.id)?.version ?? 0) !== report.version) {
      throw new ConcurrentUpdateError(`report ${report.id} changed since it was read`);
    }
    this.#write(report);
    this.saved.push(this.stored(report.id));
  }

  #write(report: Report): void {
    this.records.set(report.id, { ...report.toRecord(), version: report.version + 1 });
    report.advanceVersion();
  }

  put(record: ReportRecord): void {
    this.records.set(record.report_id, record);
  }

  stored(reportId: string): ReportRecord {
    const record = this.records.get(reportId);
    if (record === undefined) {
      throw new Error(`no stored report ${reportId}`);
    }
    return record;
  }
}

// Counts the fake repository's rows the way DynamoSnapCounter queries the reports indexes.
export class FakeSnapCounter implements SnapCounter {
  queries = 0;

  constructor(readonly reports: FakeReportRepository) {}

  async byDevice(deviceToken: string, since: string): Promise<number> {
    return this.#count((record) => record.device_token === deviceToken, since);
  }

  async byUser(userId: string, since: string): Promise<number> {
    return this.#count((record) => record.user_id === userId, since);
  }

  #count(owned: (record: ReportRecord) => boolean, since: string): number {
    this.queries += 1;
    const rows = [...this.reports.records.values()];
    return rows.filter((row) => owned(row) && row.capture_mode === "snap" && row.received_at > since).length;
  }
}

export class FakeReputationReader implements ReputationReader {
  readonly devices = new Map<string, number>();
  readonly users = new Map<string, number>();

  async ofDevice(deviceToken: string): Promise<number> {
    return this.devices.get(deviceToken) ?? 0.5;
  }

  async ofUser(userId: string): Promise<number> {
    return this.users.get(userId) ?? 0.5;
  }
}

export class FakeReportQueue implements ReportQueue {
  readonly sent: string[] = [];

  async sendReport(reportId: string): Promise<void> {
    this.sent.push(reportId);
  }
}

// Records each call into a shared journal so tests can assert the step order.
export class Journal {
  readonly calls: string[] = [];
  readonly #failures = new Map<string, number>();

  failTimes(name: string, times: number): void {
    this.#failures.set(name, times);
  }

  record(name: string): void {
    this.calls.push(name);
    const left = this.#failures.get(name) ?? 0;
    if (left > 0) {
      this.#failures.set(name, left - 1);
      throw new Error(`${name} failed`);
    }
  }
}

export class FakeModerator implements ReportModerator {
  readonly requests: ReportModerationRequest[] = [];

  constructor(readonly journal: Journal, readonly result: ModerationResult = moderation()) {}

  async moderate(request: ReportModerationRequest): Promise<ModerationResult> {
    this.journal.record("moderate");
    this.requests.push(request);
    return this.result;
  }
}

export class FakeVerifier implements MlVerifyClient {
  readonly requests: VerifyRequest[] = [];

  constructor(readonly journal: Journal, readonly result: VerificationResult = verification()) {}

  async verify(request: VerifyRequest): Promise<VerificationResult> {
    this.journal.record("verify");
    this.requests.push(request);
    return { ...this.result, report_id: request.report_id, purpose: request.purpose };
  }
}

export class FakeBrandReader implements BrandReader {
  readonly requests: BrandReadRequest[] = [];

  constructor(readonly journal: Journal) {}

  async read(request: BrandReadRequest): Promise<BrandLabel[]> {
    this.journal.record("brands");
    this.requests.push(request);
    return [fixture<BrandLabel>("brand_label.jdh-1")];
  }
}

export class FakeLocator implements ReportLocator {
  constructor(readonly journal: Journal) {}

  async locate(): Promise<LocationLookup> {
    this.journal.record("locate");
    return fixture<LocationLookup>("location_lookup.jdh-1");
  }
}

export class FakeMerger implements ReportMerger {
  readonly merged: ReportRecord[] = [];

  constructor(readonly journal: Journal, readonly outcome: MergeOutcome) {}

  async merge(report: ReportRecord): Promise<MergeOutcome> {
    this.journal.record("merge");
    this.merged.push(report);
    return this.outcome;
  }
}
