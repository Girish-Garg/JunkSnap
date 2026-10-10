import type { CleanupJob, SiteKind } from "../../domain/CleanupJob.js";
import { NotFoundError } from "../../domain/errors.js";
import type { CleanupRecorder, CleanupVerdict } from "../../ports/CleanupRecorder.js";
import type { SiteRepository } from "../../ports/sites/SiteRepository.js";
import type { CleanupService } from "../sites/CleanupService.js";

// The cleanup pipeline's recorder: the sites task decides acceptance and owns the cleanups table.
export class SiteCleanupRecorder implements CleanupRecorder {
  readonly #sites: SiteRepository;
  readonly #cleanups: CleanupService;

  constructor(sites: SiteRepository, cleanups: CleanupService) {
    this.#sites = sites;
    this.#cleanups = cleanups;
  }

  async siteKind(siteId: string): Promise<SiteKind> {
    const site = await this.#sites.get(siteId);
    if (site === null) {
      throw new NotFoundError(`site ${siteId} is gone`);
    }
    const { report_type: reportType, context } = site.toFeature().properties;
    return { report_type: reportType, context };
  }

  async settle(job: CleanupJob, verdict: CleanupVerdict): Promise<void> {
    await this.#cleanups.apply(job.id, verdict);
  }

  // No results: CleanupService rejects it, and leaves an already settled cleanup alone.
  async giveUp(job: CleanupJob): Promise<void> {
    await this.#cleanups.apply(job.id, { moderation: null, verification: null });
  }
}
