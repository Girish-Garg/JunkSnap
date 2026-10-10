import type { AreaCrawl } from "../contracts/index.gen.js";

type CrawlState = AreaCrawl["status"];

// expected_by only means something while ward data is still on its way.
const EXPECTING: readonly CrawlState[] = ["queued", "running", "failed"];

export function notStartedCrawl(districtId: string): AreaCrawl {
  return {
    district_id: districtId,
    status: "not_started",
    queued_at: null,
    last_crawled_at: null,
    next_due_at: null,
    expected_by: null,
    wards_found: null,
  };
}

export function expectsWards(status: unknown): boolean {
  return EXPECTING.some((state) => state === status);
}
