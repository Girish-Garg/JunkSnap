import { ValidationError } from "../../domain/errors.js";
import type { CleanupAccepted, CleanupRecord, CleanupRequest } from "../../domain/sites/Cleanup.js";
import type { Site } from "../../domain/sites/Site.js";
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

// POST /sites/{id}/cleanup: stores the record, queues the after-photo, then marks the site checking.
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
    // Refuses (404, 409) before anything is stored or queued.
    await this.#started(siteId, cleanupId, now);
    const record: CleanupRecord = {
      ...request,
      cleanup_id: cleanupId,
      site_id: siteId,
      user_id: userId,
      received_at: now.toISOString(),
      status: "checking",
    };
    await this.#deps.cleanups.create(record);
    return this.#queue(record, now);
  }

  // A retried POST gets the stored record back instead of a 409, and finishes the job while it is checking.
  async #resume(record: CleanupRecord, siteId: string): Promise<CleanupAccepted> {
    if (record.site_id !== siteId) {
      throw new ValidationError(`upload ${record.upload_id} is already a cleanup for another site`);
    }
    if (record.status !== "checking") {
      return CleanupIntake.#accepted(record);
    }
    const now = this.#deps.clock.now();
    await this.#started(siteId, record.cleanup_id, now);
    return this.#queue(record, now);
  }

  // Queued before the site is marked, so a failed write or send never leaves it checking with nothing to settle it.
  async #queue(record: CleanupRecord, now: Date): Promise<CleanupAccepted> {
    await this.#deps.queue.send(record);
    await this.#deps.retry.run(() => this.#markChecking(record, now));
    return CleanupIntake.#accepted(record);
  }

  // Skipped once the worker has settled the record, so a fast worker never leaves the site checking.
  async #markChecking(record: CleanupRecord, now: Date): Promise<void> {
    const current = await this.#deps.cleanups.get(record.cleanup_id);
    if (current?.status !== "checking") {
      return;
    }
    const site = await this.#started(record.site_id, record.cleanup_id, now);
    if (site !== null) {
      await this.#deps.sites.save(site);
    }
  }

  // The site with this check started in memory, or null when it already awaits it; 404 or 409 when it takes none.
  async #started(siteId: string, cleanupId: string, now: Date): Promise<Site | null> {
    const site = await this.#deps.sites.get(siteId);
    if (site === null) {
      throw new SiteNotFoundError(`No site ${siteId}`);
    }
    if (site.awaitsCleanup(cleanupId)) {
      return null;
    }
    site.startCleanup(cleanupId, now);
    return site;
  }

  static #accepted(record: CleanupRecord): CleanupAccepted {
    return { cleanup_id: record.cleanup_id, site_id: record.site_id, status: record.status };
  }
}
