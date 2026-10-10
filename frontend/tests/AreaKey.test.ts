import { describe, expect, it } from 'vitest';
import { AreaKey } from '../src/domain/AreaKey';
import { testSite } from './siteBuilder';
import { fixtureSite } from './helpers';

describe('AreaKey', () => {
  it('lists a site area by kind, smallest first, and skips a missing ward', async () => {
    const site = await fixtureSite('site_jdh_1');
    const keys = AreaKey.fromLocation(site.properties.location).map((area) => area.key);
    expect(keys).toEqual(['assembly/s20-ac-128', 'loksabha/s20-pc-16', 'district/rajasthan-jodhpur']);
  });

  it('lists each area of many sites once, by kind then name', async () => {
    const sites = await Promise.all(['site_jdh_1', 'site_jdh_2', 'site_jdh_3'].map(fixtureSite));
    const names = AreaKey.fromSites(sites).map((area) => `${area.kind}:${area.name}`);
    expect(names).toEqual(['assembly:Jodhpur', 'assembly:Sardarpura', 'loksabha:Jodhpur', 'district:Jodhpur']);
  });

  it('knows which sites an area holds', async () => {
    const site = await fixtureSite('site_jdh_2');
    expect(new AreaKey('assembly', 's20-ac-127', 'Sardarpura').holds(site)).toBe(true);
    expect(new AreaKey('assembly', 's20-ac-128', 'Jodhpur').holds(site)).toBe(false);
    expect(new AreaKey('ward', 'jodhpur-mc-w1', 'Ward 1').holds(testSite({}))).toBe(false);
  });

  it('accepts only the four contract kinds', () => {
    expect(AreaKey.isKind('loksabha')).toBe(true);
    expect(AreaKey.isKind('state')).toBe(false);
  });
});
