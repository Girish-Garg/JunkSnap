import type { Site } from "../../contracts/index.gen.js";

export interface SiteReader {
  find(siteId: string): Promise<Site | null>;
}
