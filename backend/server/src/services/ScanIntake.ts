import type { ScanSession } from "../contracts/scanSessionPending.js";
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

  async submit(session: ScanSession): Promise<ScanAccepted> {
    this.#deps.rules.check(session);
    const now = this.#deps.now().toISOString();
    const record: ScanRecord = {
      ...session, received_at: now, status: "queued", reason: null, frames: null, report_ids: [], updated_at: now,
    };
    if (!(await this.#deps.scans.create(record))) {
      return this.#resubmit(session);
    }
    await this.#deps.queue.sendScan(session.scan_id);
    return { scan_id: session.scan_id, status: "queued" };
  }

  // TODO(#34): match the signed-in user too once auth lands; the device token is the owner until then.
  async status(scanId: string, deviceToken: string | undefined): Promise<ScanStatusView> {
    const stored = await this.#deps.scans.find(scanId);
    if (stored === undefined || stored.device_token !== deviceToken) {
      throw new NotFoundError("No scan with that id for this device");
    }
    const { scan_id, status, reason, frames, report_ids, received_at, updated_at } = stored;
    return { scan_id, status, reason, frames, report_ids, received_at, updated_at };
  }

  // A retry while still queued sends the message again, in case the first send was lost.
  async #resubmit(session: ScanSession): Promise<ScanAccepted> {
    const stored = await this.#deps.scans.find(session.scan_id);
    if (stored?.device_token !== session.device_token) {
      throw new ValidationError("scan_id is taken; ask POST /scans/presign for a new one");
    }
    if (stored.status === "queued") {
      await this.#deps.queue.sendScan(session.scan_id);
    }
    return { scan_id: stored.scan_id, status: stored.status };
  }
}
