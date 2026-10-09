import type { ScanSession } from "../contracts/index.gen.js";
import { NotFoundError, ValidationError } from "../domain/errors.js";
import type { ScanFailureReason, ScanFrameCounts, ScanRecord, ScanStatus } from "../domain/ScanRecord.js";
import type { ScanQueue } from "../ports/ScanQueue.js";
import type { ScanRepository } from "../ports/ScanRepository.js";
import type { ScanSessionRules } from "./ScanSessionRules.js";

export interface ScanAccepted {
  readonly scan_id: string;
  readonly status: ScanStatus;
}

export interface ScanStatusView extends ScanAccepted {
  readonly reason: ScanFailureReason | null;
  readonly frames: ScanFrameCounts | null;
  readonly report_ids: readonly string[];
  readonly received_at: string;
  readonly updated_at: string;
}

export interface ScanIntakeDeps {
  readonly scans: ScanRepository;
  readonly queue: ScanQueue;
  readonly rules: ScanSessionRules;
  readonly now: () => Date;
}

export class ScanIntake {
  readonly #deps: ScanIntakeDeps;

  constructor(deps: ScanIntakeDeps) {
    this.#deps = deps;
  }

  // userId is the verified token's sub; any user_id in the posted body has already been dropped.
  async submit(session: ScanSession, userId: string): Promise<ScanAccepted> {
    this.#deps.rules.check(session);
    const now = this.#deps.now().toISOString();
    const record: ScanRecord = {
      ...session, user_id: userId, received_at: now, status: "queued", reason: null, frames: null, report_ids: [], updated_at: now,
    };
    if (!(await this.#deps.scans.create(record))) {
      return this.#resubmit(session.scan_id, userId);
    }
    await this.#deps.queue.sendScan(session.scan_id);
    return { scan_id: session.scan_id, status: "queued" };
  }

  // Another user's scan answers 404 exactly like a missing one.
  async status(scanId: string, userId: string): Promise<ScanStatusView> {
    const stored = await this.#deps.scans.find(scanId);
    if (stored === undefined || stored.user_id !== userId) {
      throw new NotFoundError("No scan with that id");
    }
    const { scan_id, status, reason, frames, report_ids, received_at, updated_at } = stored;
    return { scan_id, status, reason, frames, report_ids, received_at, updated_at };
  }

  // A retry while still queued sends the message again, in case the first send was lost.
  async #resubmit(scanId: string, userId: string): Promise<ScanAccepted> {
    const stored = await this.#deps.scans.find(scanId);
    if (stored?.user_id !== userId) {
      throw new ValidationError("scan_id is taken; ask POST /scans/presign for a new one");
    }
    if (stored.status === "queued") {
      await this.#deps.queue.sendScan(scanId);
    }
    return { scan_id: stored.scan_id, status: stored.status };
  }
}
