import { ValidationError } from "../../domain/errors.js";
import type { CleanupAccepted, CleanupRecord, CleanupRequest } from "../../domain/sites/Cleanup.js";
import { SiteNotFoundError } from "../../domain/sites/SiteErrors.js";
import type { CleanupQueue } from "../../ports/sites/CleanupQueue.js";
import type { CleanupRepository } from "../../ports/sites/CleanupRepository.js";
import type { Clock } from "../../ports/sites/Clock.js";
import type { SiteRepository } from "../../ports/sites/SiteRepository.js";
import type { ConflictRetry } from "./ConflictRetry.js";

const UPLOAD_PREFIX = "upl_";

export interface CleanupIntakeDeps {
  readonly sites: SiteRepository;
  readonly cleanups: CleanupRepository;
  readonly queue: CleanupQueue;
  readonly clock: Clock;
  readonly retry: ConflictRetry;
}

// POST /sites/{id}/cleanup: marks the site checking, stores the record and queues the after-photo.
export class CleanupIntake {
  readonly #deps: CleanupIntakeDeps;

  constructor(deps: CleanupIntakeDeps) {
    this.#deps = deps;
  }

  // userId comes from the verified sign-in token; null only for a guest.
  async submit(siteId: string, request: CleanupRequest, userId: string | null): Promise<CleanupAccepted> {
    const cleanupId = `cln_${request.upload_id.slice(UPLOAD_PREFIX.length)}`;
    const existing = await this.#deps.cleanups.get(cleanupId);
    if (existing !== null) {
      return this.#resume(existing, siteId);
    }
    const now = this.#deps.clock.now();
    await this.#deps.retry.run(() => this.#markChecking(siteId, cleanupId, now));
    const receivedAt = now.toISOString();
    const record: CleanupRecord = {
      ...request,
      cleanup_id: cleanupId,
      site_id: siteId,
      user_id: userId,
      received_at: receivedAt,
      status: "checking",
    };
    await this.#deps.cleanups.create(record);
    await this.#deps.queue.send(record);
    return CleanupIntake.#accepted(record);
  }

  // A retried POST gets the stored record back instead of a 409, and re-queues it while checking.
  async #resume(record: CleanupRecord, siteId: string): Promise<CleanupAccepted> {
    if (record.site_id !== siteId) {
      throw new ValidationError(`upload ${record.upload_id} is already a cleanup for another site`);
    }
    if (record.status === "checking") {
      await this.#deps.queue.send(record);
    }
    return CleanupIntake.#accepted(record);
  }

  async #markChecking(siteId: string, cleanupId: string, now: Date): Promise<void> {
    const site = await this.#deps.sites.get(siteId);
    if (site === null) {
      throw new SiteNotFoundError(`No site ${siteId}`);
    }
    if (site.awaitsCleanup(cleanupId)) {
      return;
    }
    site.startCleanup(cleanupId, now);
    await this.#deps.sites.save(site);
  }

  static #accepted(record: CleanupRecord): CleanupAccepted {
    return { cleanup_id: record.cleanup_id, site_id: record.site_id, status: record.status };
  }
}
