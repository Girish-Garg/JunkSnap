import type { SiteFeature } from "../../domain/sites/SiteTypes.js";
import type { ShareSiteSource } from "../../ports/share/ShareSources.js";
import { SiteRequests } from "../sites/SiteRequests.js";

// Checks the id as GET /sites/{id} does (a malformed id is 404) before the table is read.
export class CheckedSiteSource implements ShareSiteSource {
  readonly #sites: ShareSiteSource;
  readonly #requests = new SiteRequests();

  constructor(sites: ShareSiteSource) {
    this.#sites = sites;
  }

  byId(siteId: string): Promise<SiteFeature> {
    return this.#sites.byId(this.#requests.siteId({ id: siteId }));
  }
}
