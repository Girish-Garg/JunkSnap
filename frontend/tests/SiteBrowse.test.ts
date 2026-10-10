import { describe, expect, it } from 'vitest';
import { BBox } from '../src/domain/BBox';
import { PilotCity } from '../src/domain/PilotCity';
import type { SiteFeature } from '../src/domain/Site';
import { SiteBrowse } from '../src/domain/SiteBrowse';
import { SiteChip } from '../src/domain/SiteChip';
import { SiteFilter } from '../src/domain/SiteFilter';
import { SiteOrder } from '../src/domain/SiteOrder';
import { SiteSteps } from '../src/domain/SiteSteps';
import { testSite } from './siteBuilder';

const ids = (sites: readonly SiteFeature[]) => sites.map((site) => site.properties.site_id);

// Three Jodhpur sites: near the centre and old, farther and newest, farthest and most backed.
const NEAR = testSite({ site_id: 'near', coordinates: [73.021, 26.271], last_reported_at: '2026-10-01T00:00:00Z', backers: { count: 2, needed: 10, photo_people: 2, vote_people: 0 }, verification: 'unverified' });
const MIDDLE = testSite({ site_id: 'middle', coordinates: [73.04, 26.29], last_reported_at: '2026-10-10T00:00:00Z', backers: { count: 4, needed: 10, photo_people: 4, vote_people: 0 }, verification: 'unverified' });
const FAR = testSite({ site_id: 'far', coordinates: [73.07, 26.34], last_reported_at: '2026-10-05T00:00:00Z', report_type: 'no_bin' });
const JAIPUR = testSite({ site_id: 'jaipur', coordinates: [75.8156, 26.853] });
const CLEANED = testSite({ site_id: 'cleaned', coordinates: [73.03, 26.28], status: 'cleaned' });

describe('SiteOrder', () => {
  it('sorts nearest first from a point, newest first, or most backed first', () => {
    const sites = [FAR, NEAR, MIDDLE];
    expect(ids(SiteOrder.sort(sites, 'nearest', PilotCity.centre))).toEqual(['near', 'middle', 'far']);
    expect(ids(SiteOrder.sort(sites, 'newest', PilotCity.centre))).toEqual(['middle', 'far', 'near']);
    expect(ids(SiteOrder.sort(sites, 'backed', PilotCity.centre))).toEqual(['far', 'middle', 'near']);
  });

  it('defaults to nearest only when the person\'s location is known', () => {
    expect(SiteOrder.defaultFor(true)).toBe('nearest');
    expect(SiteOrder.defaultFor(false)).toBe('newest');
  });

  it('breaks ties by newest, then by id, so the order never shuffles', () => {
    const a = testSite({ site_id: 'a', last_reported_at: '2026-10-01T00:00:00Z' });
    const b = testSite({ site_id: 'b', last_reported_at: '2026-10-01T00:00:00Z' });
    expect(ids(SiteOrder.sort([b, a], 'backed', PilotCity.centre))).toEqual(['a', 'b']);
  });
});

describe('SiteBrowse.rows', () => {
  const view = SiteBrowse.source([FAR, NEAR, MIDDLE, CLEANED], new BBox(72.9, 26.2, 73.1, 26.4));

  it('lists the view\'s sites through the filters, never a cleaned one', () => {
    const rows = SiteBrowse.rows({ source: view, loaded: [], pilot: null, filter: new SiteFilter(['no_bin']) }, 'newest', null);
    expect(ids(rows.sites)).toEqual(['middle', 'near']);
    expect(rows.fallback).toBe(false);
  });

  it('falls back to the pilot city\'s sites when the view holds none', () => {
    const empty = SiteBrowse.source([], new BBox(80, 20, 80.1, 20.1));
    const rows = SiteBrowse.rows({ source: empty, loaded: [], pilot: [NEAR, JAIPUR, FAR], filter: new SiteFilter() }, 'nearest', null);
    expect(rows.fallback).toBe(true);
    expect(ids(rows.sites)).toEqual(['near', 'far']);
  });

  it('drops a frozen row once the loaded copy of its site has left the map', () => {
    const gone = testSite({ site_id: 'near', coordinates: NEAR.geometry.coordinates, status: 'removed' });
    const rows = SiteBrowse.rows({ source: view, loaded: [gone], pilot: null, filter: new SiteFilter() }, 'newest', null);
    expect(ids(rows.sites)).toEqual(['middle', 'far']);
  });
});

describe('SiteSteps', () => {
  it('steps through the list without wrapping round', () => {
    const steps = SiteSteps.at([NEAR, MIDDLE, FAR], 'near');
    expect(steps?.position).toBe(1);
    expect(steps?.total).toBe(3);
    expect(steps?.previous()).toBeNull();
    expect(steps?.next()?.properties.site_id).toBe('middle');
    expect(SiteSteps.at([NEAR], 'elsewhere')).toBeNull();
  });
});

describe('SiteChip', () => {
  it('says waiting with the count, verified, or cleared while people confirm the clearing', () => {
    expect(SiteChip.of(MIDDLE.properties)).toEqual({ kind: 'waiting', count: 4, needed: 10 });
    expect(SiteChip.of(FAR.properties)).toEqual({ kind: 'verified', count: null, needed: null });
    const clearing = testSite({ clearance: { count: 1, needed: 3, still_there: 0 } });
    expect(SiteChip.of(clearing.properties)).toEqual({ kind: 'cleared', count: 1, needed: 3 });
  });
});
