import { useEffect, useState } from 'react';
import { useServices } from '../../../app/useServices';
import type { AreaCrawl } from '../../../domain/AreaCrawl';

/** Where the district's ward crawl stands; null while loading, on an error or without a district. */
export function useAreaCrawl(districtId: string | null): AreaCrawl | null {
  const { areas } = useServices();
  const [crawl, setCrawl] = useState<AreaCrawl | null>(null);
  useEffect(() => {
    if (!districtId) return undefined;
    let current = true;
    areas.crawl(districtId).then(
      (next) => {
        if (current) setCrawl(next);
      },
      (error: unknown) => console.error(`Could not load the ward crawl for ${districtId}`, error),
    );
    return () => {
      current = false;
    };
  }, [areas, districtId]);
  return crawl !== null && crawl.district_id === districtId ? crawl : null;
}
