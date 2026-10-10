import type { WardScores } from "../../contracts/index.gen.js";
import type { SiteFeature } from "../../domain/sites/SiteTypes.js";

// GET /sites/{id} as the api shows it (SiteFinder); throws NotFoundError for an unknown site.
export interface ShareSiteSource {
  byId(siteId: string): Promise<SiteFeature>;
}

// GET /areas/{kind}/{id}/scores (AreaScoresQuery); throws NotFoundError or ValidationError for an unknown area.
export interface ShareAreaSource {
  find(kind: string, id: string): Promise<WardScores>;
}
