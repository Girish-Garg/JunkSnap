import { describe, expect, it } from 'vitest';
import { BBox } from '../src/domain/BBox';
import { SiteFilter } from '../src/domain/SiteFilter';
import { MockApiClient } from '../src/services/MockApiClient';
import { siteFixtureLoaders } from '../src/services/siteFixtures';

const sitesPromise = new MockApiClient(siteFixtureLoaders).listSites(new BBox(60, 4, 100, 38.5));
const idsOf = async (filter: SiteFilter) => filter.apply(await sitesPromise).map((site) => site.properties.site_id);

describe('SiteFilter', () => {
  it('shows every type until one is switched off', async () => {
    expect(await idsOf(new SiteFilter())).toHaveLength((await sitesPromise).length);
    const noDumps = new SiteFilter().toggleType('waste_dump');
    expect(await idsOf(noDumps)).not.toContain('site_jdh_1');
    expect(noDumps.activeCount()).toBe(1);
    expect(await idsOf(noDumps.toggleType('waste_dump'))).toContain('site_jdh_1');
  });

  it('hides unverified or verified sites when switched off', async () => {
    const verifiedOnly = new SiteFilter().toggleState('unverified');
    expect(await idsOf(verifiedOnly)).not.toContain('site_jpr_1');
    expect(await idsOf(verifiedOnly)).toContain('site_jdh_1');
    expect(verifiedOnly.activeCount()).toBe(1);
    const unverifiedOnly = new SiteFilter().toggleState('verified');
    expect(await idsOf(unverifiedOnly)).toEqual(['site_jpr_1']);
  });

  it('counts sites per type for the filter sheet', async () => {
    const counts = SiteFilter.countByType(await sitesPromise);
    expect(counts).toEqual({ waste_dump: 1, no_bin: 1, contaminated_water: 1, open_construction: 1, overflowing_bin: 1 });
  });

  it('hides overflowing or broken bins when that type is switched off', async () => {
    expect(await idsOf(new SiteFilter())).toContain('site_jdh_4');
    const noBins = new SiteFilter().toggleType('overflowing_bin');
    expect(await idsOf(noBins)).not.toContain('site_jdh_4');
    expect(await idsOf(noBins)).toContain('site_jdh_1');
  });
});
