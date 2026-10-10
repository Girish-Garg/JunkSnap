import type { AreaCrawl } from "../contracts/index.gen.js";

// Where the ward crawl of one district stands; a district with no row is not_started.
export interface CrawlStatusReader {
  get(districtId: string): Promise<AreaCrawl>;
}
