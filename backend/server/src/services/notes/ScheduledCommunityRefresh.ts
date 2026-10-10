import type { CommunityTrigger } from "../../ports/flags/PhotoFlagStore.js";
import type { Logger } from "../../ports/Logger.js";
import type { Scheduler } from "../../ports/notes/NoteStore.js";
import type { CommunityRefresher } from "./CommunityRefresher.js";

// Starts the site's community refresh after the answer; a failure is logged, never thrown at the resident.
export class ScheduledCommunityRefresh implements CommunityTrigger {
  readonly #scheduler: Scheduler;
  readonly #refresher: CommunityRefresher;
  readonly #logger: Logger;

  constructor(scheduler: Scheduler, refresher: CommunityRefresher, logger: Logger) {
    this.#scheduler = scheduler;
    this.#refresher = refresher;
    this.#logger = logger;
  }

  textAccepted(siteId: string): void {
    this.#scheduler.after(0, async () => {
      try {
        await this.#refresher.noteAccepted(siteId);
      } catch (error) {
        this.#logger.error({ error, site_id: siteId }, "community refresh failed");
      }
    });
  }
}
