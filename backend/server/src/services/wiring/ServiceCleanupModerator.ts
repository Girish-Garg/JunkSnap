import type { ModerationResult } from "../../contracts/index.gen.js";
import type { CleanupJob } from "../../domain/CleanupJob.js";
import { InternalDataError } from "../../domain/errors.js";
import { GeoPoint } from "../../domain/moderation/GeoPoint.js";
import { PhotoSubmission } from "../../domain/moderation/PhotoSubmission.js";
import type { CleanupModerator } from "../../ports/CleanupModerator.js";
import type { SiteRepository } from "../../ports/sites/SiteRepository.js";
import type { ModerationService } from "../moderation/ModerationService.js";

// Cleanup after-photos go through the same moderation, with the site's position for the near_site check.
export class ServiceCleanupModerator implements CleanupModerator {
  readonly #service: ModerationService;
  readonly #sites: SiteRepository;

  constructor(service: ModerationService, sites: SiteRepository) {
    this.#service = service;
    this.#sites = sites;
  }

  async moderate(job: CleanupJob): Promise<ModerationResult> {
    const site = await this.#sites.get(job.data.site_id);
    if (site === null) {
      throw new InternalDataError(`cleanup ${job.id} names a missing site`);
    }
    const point = new GeoPoint(site.point.lat, site.point.lon);
    return this.#service.moderate(PhotoSubmission.fromCleanup(job.data, point));
  }
}
