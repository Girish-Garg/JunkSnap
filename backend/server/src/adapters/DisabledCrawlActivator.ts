import type { CrawlActivator } from "../ports/CrawlActivator.js";

// Without CRAWLS_TABLE (local dev) no district is ever queued.
export class DisabledCrawlActivator implements CrawlActivator {
  async activate(): Promise<void> {
    return Promise.resolve();
  }
}
