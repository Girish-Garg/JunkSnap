import { InternalDataError } from "../../domain/errors.js";
import type { CleanupOutcome, CleanupRecord, CleanupStatus } from "../../domain/sites/Cleanup.js";
import type { PublicMedia } from "../../domain/sites/PublicMedia.js";
import { personOf } from "../../domain/sites/utils.js";
import { VoteTally } from "../../domain/sites/VoteTally.js";
import type { CleanupRepository } from "../../ports/sites/CleanupRepository.js";
import type { SiteRepository } from "../../ports/sites/SiteRepository.js";
import type { VoteRepository } from "../../ports/sites/VoteRepository.js";
import type { ConflictRetry } from "./ConflictRetry.js";

export interface CleanupServiceDeps {
  readonly sites: SiteRepository;
  readonly cleanups: CleanupRepository;
  // Cleared votes join the after-photos in the clearance count (decision 20261010-1855).
  readonly votes: VoteRepository;
  readonly media: PublicMedia;
  readonly retry: ConflictRetry;
}

interface Acceptance {
  readonly photoUrl: string;
}

// Worker side: applies the moderation and verification of an after-photo to its site.
export class CleanupService {
  readonly #deps: CleanupServiceDeps;

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
    const acceptance = await this.#deps.retry.run(() => this.#settleSite(record, this.#acceptance(cleanupId, outcome)));
    const status = acceptance === null ? "rejected" : "accepted";
    await this.#deps.cleanups.finish(cleanupId, { status, ...outcome });
    return status;
  }

  // Accepted only when moderation passed and is_clean is true; the photo is then one person's cleared word.
  #acceptance(cleanupId: string, outcome: CleanupOutcome): Acceptance | null {
    CleanupService.#assertBelongs(cleanupId, outcome);
    const { moderation, verification } = outcome;
    if (moderation?.outcome !== "passed" || moderation.blurred_key === null) {
      return null;
    }
    if (verification?.is_clean !== true) {
      return null;
    }
    return { photoUrl: this.#deps.media.urlFor(moderation.blurred_key) };
  }

  static #assertBelongs(cleanupId: string, { moderation, verification }: CleanupOutcome): void {
    const ids = [moderation?.report_id, verification?.report_id].filter((id) => id !== undefined);
    if (ids.some((id) => id !== cleanupId)) {
      throw new InternalDataError(`results for ${ids.join(", ")} do not belong to ${cleanupId}`);
    }
  }

  static #uploader(record: CleanupRecord): string {
    return personOf({ userId: record.user_id, deviceToken: record.device_token });
  }

  // Returns the acceptance that stands; a site withdrawn (decision 20261010-1700) or expired meanwhile rejects the cleanup.
  async #settleSite(record: CleanupRecord, acceptance: Acceptance | null): Promise<Acceptance | null> {
    const site = await this.#deps.sites.get(record.site_id);
    // A site withdrawn or expired (decision 20261010-1855) meanwhile takes no cleared word.
    const status = site?.snapshot().feature.properties.status;
    if (status === "removed" || status === "expired") {
      return null;
    }
    if (site === null || !site.awaitsCleanup(record.cleanup_id)) {
      return acceptance;
    }
    if (acceptance === null) {
      site.rejectCleanup(record.cleanup_id);
    } else {
      const tally = VoteTally.of(await this.#deps.votes.forSite(record.site_id));
      // received_at is server time, like the votes it is counted with.
      const photo = { cleanupId: record.cleanup_id, photoUrl: acceptance.photoUrl, person: CleanupService.#uploader(record), at: record.received_at };
      site.acceptCleanup(photo, tally);
    }
    await this.#deps.sites.save(site);
    return acceptance;
  }
}
