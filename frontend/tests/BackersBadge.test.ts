import { describe, expect, it } from 'vitest';
import { BackersBadge } from '../src/domain/BackersBadge';
import { MarkerArt } from '../src/ui/MarkerArt';
import { siteFixtureLoaders } from '../src/services/siteFixtures';
import { MockApiClient } from '../src/services/MockApiClient';
import { BBox } from '../src/domain/BBox';

const sites = new MockApiClient(siteFixtureLoaders).listSites(new BBox(60, 4, 100, 38.5));

describe('unverified pins', () => {
  it('label an unverified site n/10 and a verified one not at all', async () => {
    const byId = Object.fromEntries((await sites).map((site) => [site.properties.site_id, site.properties]));
    expect(BackersBadge.of(byId.site_jpr_1!)).toBe('2/10');
    expect(BackersBadge.of(byId.site_jdh_1!)).toBe('');
  });

  it('draw a dashed outline in the type colour instead of a filled disc', () => {
    const hollow = MarkerArt.svg('waste_dump', 64, false, true);
    expect(hollow).toContain('stroke-dasharray');
    expect(hollow).toContain('fill="#fffdf8" stroke="#c5221f"');
    expect(MarkerArt.svg('waste_dump', 64)).not.toContain('stroke-dasharray');
  });
});
