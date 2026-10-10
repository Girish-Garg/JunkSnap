import type { SiteFeature, SiteLocation, SiteProperties } from '../src/domain/Site';

// Test-only data, so tests that need a ward or a missing seat do not depend on shared fixtures.
const LOCATION: SiteLocation = {
  state: 'Rajasthan',
  district: { id: 'rajasthan-jodhpur', name: 'Jodhpur' },
  town: 'Jodhpur',
  local_body: { id: 'test-mc', name: 'Test Municipal Corporation', head_office: 'Commissioner' },
  ward: { id: 'test-mc-w37', name: 'Ward 37' },
  assembly_seat: { id: 's20-ac-127', name: 'Sardarpura' },
  loksabha_seat: { id: 's20-pc-16', name: 'Jodhpur', status: 'current' },
  representatives: [],
};

const PROPERTIES: SiteProperties = {
  site_id: 'site_test_1',
  report_type: 'waste_dump',
  context: 'vacant_plot',
  status: 'open',
  verification: 'verified',
  report_count: 7,
  verified_count: 6,
  corroborations: 4,
  backers: { count: 10, needed: 10, photo_people: 8, vote_people: 2 },
  votes: { confirm: 2, reject: 0 },
  photo_urls: ['https://example.test/media/reports/rpt_test_1.jpg'],
  cleanup_status: 'none',
  cleanup_photo_url: null,
  burning: false,
  location: LOCATION,
  brands: [],
  first_reported_at: '2026-10-09T03:40:00Z',
  last_reported_at: '2026-10-10T02:14:05Z',
  cleaned_at: null,
  pilot: true,
};

export interface SitePatch extends Partial<Omit<SiteProperties, 'location'>> {
  readonly location?: Partial<SiteLocation>;
  readonly coordinates?: readonly [number, number];
}

export function testSite(patch: SitePatch = {}): SiteFeature {
  const { location, coordinates, ...properties } = patch;
  return {
    type: 'Feature',
    geometry: { type: 'Point', coordinates: coordinates ?? [73.0035, 26.2618] },
    properties: { ...PROPERTIES, ...properties, location: { ...LOCATION, ...location } },
  };
}
