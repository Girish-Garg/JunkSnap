import type { AreaCrawl } from "../contracts/index.gen.js";
import { notStartedCrawl } from "../domain/CrawlStatus.js";
import type { CrawlStatusReader } from "../ports/CrawlStatusReader.js";

// Without CRAWLS_TABLE (local dev, mock setups) every district is not_started.
export class DisabledCrawlStatusReader implements CrawlStatusReader {
  async get(districtId: string): Promise<AreaCrawl> {
    return Promise.resolve(notStartedCrawl(districtId));
  }
}
