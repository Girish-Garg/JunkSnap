import { InternalDataError } from "../../domain/errors.js";
import type { CleanupOutcome, CleanupRecord, CleanupStatus } from "../../domain/sites/Cleanup.js";
import type { PublicMedia } from "../../domain/sites/PublicMedia.js";
import type { CleanupRepository } from "../../ports/sites/CleanupRepository.js";
import type { SiteRepository } from "../../ports/sites/SiteRepository.js";
import { ConflictRetry } from "./ConflictRetry.js";

export interface CleanupServiceDeps {
  readonly sites: SiteRepository;
  readonly cleanups: CleanupRepository;
  readonly media: PublicMedia;
}

interface Acceptance {
  readonly photoUrl: string;
  readonly cleanedAt: string;
}

// Worker side: applies the moderation and verification of an after-photo to its site.
export class CleanupService {
  readonly #deps: CleanupServiceDeps;
  readonly #retry = new ConflictRetry();

  constructor(deps: CleanupServiceDeps) {
    this.#deps = deps;
  }

  // A no-op unless the cleanup is still checking, so a redelivered message changes nothing.
  async apply(cleanupId: string, outcome: CleanupOutcome): Promise<CleanupStatus> {
    const record = await this.#deps.cleanups.get(cleanupId);
    if (record === null) {
      throw new InternalDataError(`No cleanup record ${cleanupId}`);
    }
    if (record.status !== "checking") {
      return record.status;
    }
    const acceptance = this.#acceptance(cleanupId, outcome);
    await this.#retry.run(() => this.#settleSite(record, acceptance));
    const status = acceptance === null ? "rejected" : "accepted";
    await this.#deps.cleanups.finish(cleanupId, { status, ...outcome });
    return status;
  }

  // Accepted only when moderation passed and is_clean is true; cleaned_at is the decision time (jdh-3).
  #acceptance(cleanupId: string, outcome: CleanupOutcome): Acceptance | null {
    CleanupService.#assertBelongs(cleanupId, outcome);
    const { moderation, verification } = outcome;
    if (moderation?.outcome !== "passed" || moderation.blurred_key === null) {
      return null;
    }
    if (verification?.is_clean !== true) {
      return null;
    }
    return { photoUrl: this.#deps.media.urlFor(moderation.blurred_key), cleanedAt: verification.decided_at };
  }

  static #assertBelongs(cleanupId: string, { moderation, verification }: CleanupOutcome): void {
    const ids = [moderation?.report_id, verification?.report_id].filter((id) => id !== undefined);
    if (ids.some((id) => id !== cleanupId)) {
      throw new InternalDataError(`results for ${ids.join(", ")} do not belong to ${cleanupId}`);
    }
  }

  async #settleSite(record: CleanupRecord, acceptance: Acceptance | null): Promise<void> {
    const site = await this.#deps.sites.get(record.site_id);
    if (site === null || !site.awaitsCleanup(record.cleanup_id)) {
      return;
    }
    if (acceptance === null) {
      site.rejectCleanup(record.cleanup_id);
    } else {
      site.acceptCleanup(record.cleanup_id, acceptance.photoUrl, acceptance.cleanedAt);
    }
    await this.#deps.sites.save(site);
  }
}
