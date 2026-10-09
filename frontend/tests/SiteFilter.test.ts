import { describe, expect, it } from 'vitest';
import { BBox } from '../src/domain/BBox';
import { SiteFilter } from '../src/domain/SiteFilter';
import { MockApiClient } from '../src/services/MockApiClient';
import { siteFixtureLoaders } from '../src/services/siteFixtures';

const sitesPromise = new MockApiClient(siteFixtureLoaders).listSites(new BBox(60, 4, 100, 38.5));
const idsOf = async (filter: SiteFilter) => filter.apply(await sitesPromise).map((site) => site.properties.site_id);

describe('SiteFilter', () => {
  it('shows every site when no chip is on', async () => {
    expect(await idsOf(new SiteFilter())).toHaveLength((await sitesPromise).length);
  });

  it('keeps only the chosen types', async () => {
    const filter = new SiteFilter().toggleType('waste_dump').toggleType('no_bin');
    expect((await idsOf(filter)).sort()).toEqual(['site_jdh_1', 'site_jdh_2']);
  });

  it('turns a type off again and combines with verified only', async () => {
    const filter = new SiteFilter().toggleType('open_construction').toggleVerifiedOnly();
    expect(await idsOf(filter)).toEqual([]);
    expect(await idsOf(filter.toggleType('open_construction'))).not.toContain('site_jpr_1');
  });
});
