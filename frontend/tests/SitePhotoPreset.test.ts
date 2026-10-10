import { describe, expect, it } from 'vitest';
import { SITE_GATES, type SiteActionFacts } from '../src/domain/SiteActionGates';
import { SitePhotoPreset } from '../src/domain/SitePhotoPreset';
import { testSite } from './siteBuilder';

// testSite stands at 73.0035 E, 26.2618 N; 0.001 degrees of latitude is about 111 m.
const SITE = testSite({ coordinates: [73.0035, 26.2618] });
const preset = SitePhotoPreset.of(SITE);
const at = (metresNorth: number) => ({ lat: 26.2618 + metresNorth / 111_195, lon: 73.0035 });

describe('SitePhotoPreset', () => {
  it('keeps a photo within 40 m as it is, with the site id for the merge', () => {
    expect(preset.reach(at(30)).kind).toBe('here');
    expect(preset.choice(at(30), '  by the wall ')).toEqual({
      report_type: 'waste_dump',
      context: 'vacant_plot',
      me_too_site_id: 'site_test_1',
      note: 'by the wall',
    });
  });

  it('marks a photo from 40 to 300 m on the site point as a long-range target (decision 20261011-0400)', () => {
    expect(preset.choice(at(200), '')).toEqual({
      report_type: 'waste_dump',
      context: 'vacant_plot',
      me_too_site_id: 'site_test_1',
      target: { lat: 26.2618, lon: 73.0035 },
    });
    expect(preset.reach(at(290)).kind).toBe('longRange');
  });
});

describe('SitePhotoPreset limits', () => {
  it('refuses a ground photo past 300 m; up high reaches 490 m, 10 m inside the 500 m server cap', () => {
    expect(preset.reach(at(350))).toMatchObject({ kind: 'tooFar', limit: 300 });
    expect(preset.choice(at(350), '')).toBeNull();
    expect(preset.choice(at(350), '', true)).toMatchObject({ target: { lat: 26.2618, lon: 73.0035 }, me_too_site_id: 'site_test_1' });
    expect(preset.reach(at(485), true).kind).toBe('longRange');
    expect(preset.reach(at(495), true)).toMatchObject({ kind: 'tooFar', limit: 490 });
  });

  it('keeps a no-bin zone to 40 m with no target, up high or not', () => {
    const zone = SitePhotoPreset.of(testSite({ report_type: 'no_bin', context: 'no_bin', coordinates: [73.0035, 26.2618] }));
    expect(zone.takesTarget).toBe(false);
    expect(zone.limitM(true)).toBe(40);
    expect(zone.choice(at(100), '', true)).toBeNull();
    expect(zone.choice(at(20), '')).not.toHaveProperty('target');
  });
});

// #132's AddPhotoGate now lives in SITE_GATES.addPhoto (decision 20261011-0303), with the same rules and order.
const FACTS: SiteActionFacts = {
  signedIn: true,
  online: true,
  cooling: new Set(),
  site: { verification: 'unverified', status: 'open', cleanup_status: 'none' },
  ownSite: false,
  distanceM: 100,
  locationDenied: false,
  addPhotoLimitM: 500,
};
const decide = (patch: Partial<SiteActionFacts>) => SITE_GATES.addPhoto.decide({ ...FACTS, ...patch });

describe('SITE_GATES.addPhoto', () => {

  it('lets a signed-in person near an open site add a photo', () => {
    expect(decide({})).toEqual({ enabled: true });
    expect(decide({ distanceM: null })).toEqual({ enabled: true });
  });

  it('says closed first, then too far (a tap takes a fresh fix), then sign in; offline is fine, as Snap queues', () => {
    const closed = { site: { verification: 'unverified', status: 'removed', cleanup_status: 'none' } } as const;
    expect(decide({ ...closed, distanceM: 5000, signedIn: false })).toEqual({ enabled: false, reason: 'addPhoto.closed' });
    expect(decide({ distanceM: 5000, signedIn: false })).toEqual({ enabled: false, reason: 'addPhoto.tooFar', params: { limit: 500 }, remedy: 'relocate' });
    expect(decide({ online: false })).toEqual({ enabled: true });
    expect(decide({ signedIn: false })).toEqual({ enabled: false, reason: 'addPhoto.signIn', remedy: 'signIn' });
  });

  it('allows the map fix a 100 m margin, since Send checks the photo fix', () => {
    expect(decide({ distanceM: 590 }).enabled).toBe(true);
    expect(decide({ distanceM: 610 }).enabled).toBe(false);
  });
});
