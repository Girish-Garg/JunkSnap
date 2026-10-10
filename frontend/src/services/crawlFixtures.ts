import type { AreaCrawl } from '../domain/AreaCrawl';

export type CrawlFixtureLoaders = Readonly<Record<string, () => Promise<AreaCrawl>>>;

export const crawlFixtureLoaders: CrawlFixtureLoaders = import.meta.glob<AreaCrawl>(
  '../../../contracts/fixtures/area_crawl.*.json',
  { import: 'default' },
);
