// Mirrors contracts/schemas/area_crawl.schema.json (GET /areas/district/{id}/crawl); change the contract first.

export type CrawlStatus = 'not_started' | 'queued' | 'running' | 'done' | 'failed' | 'no_sources';

/** Times are ISO 8601 UTC; expected_by is null for done, no_sources and not_started. */
export interface AreaCrawl {
  readonly district_id: string;
  readonly status: CrawlStatus;
  readonly queued_at: string | null;
  readonly last_crawled_at: string | null;
  readonly next_due_at: string | null;
  readonly expected_by: string | null;
  readonly wards_found: number | null;
}

/** What the api answers for a district with no row in the crawls table, and when ward data is still coming. */
export class CrawlProgress {
  static notStarted(districtId: string): AreaCrawl {
    return {
      district_id: districtId,
      status: 'not_started',
      queued_at: null,
      last_crawled_at: null,
      next_due_at: null,
      expected_by: null,
      wards_found: null,
    };
  }

  /** Every status but done means official ward data is not in yet. */
  static collecting(crawl: AreaCrawl): boolean {
    return crawl.status !== 'done';
  }
}
