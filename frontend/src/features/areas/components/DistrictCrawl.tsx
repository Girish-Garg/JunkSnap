import { useAreaCrawl } from '../hooks/useAreaCrawl';
import { CrawlBanner } from './CrawlBanner';

interface DistrictCrawlProps {
  readonly districtId: string | null;
}

/** Loads the district's ward crawl and shows the crawl banner for it. */
export function DistrictCrawl({ districtId }: DistrictCrawlProps) {
  return <CrawlBanner crawl={useAreaCrawl(districtId)} />;
}
