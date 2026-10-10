// Queues a district for a ward crawl once enough verified reports arrive; a repeat for one report id changes nothing.
export interface CrawlActivator {
  activate(district: CrawlDistrict, reportId: string): Promise<void>;
}

export interface CrawlDistrict {
  readonly id: string;
  readonly name: string;
}
