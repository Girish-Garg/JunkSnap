import { describe, expect, it } from 'vitest';
import { BBox } from '../src/domain/BBox';
import type { SiteFeature } from '../src/domain/Site';
import { SITES_PER_QUERY, SiteTiles } from '../src/domain/SiteTiles';
import { testSite } from './siteBuilder';

const spans = (box: BBox) => [box.maxLon - box.minLon, box.maxLat - box.minLat];
const site = (id: string, at: string, patch: Parameters<typeof testSite>[0] = {}): SiteFeature =>
  testSite({ site_id: id, last_reported_at: at, ...patch });

describe('BBox.split', () => {
  it('keeps a box under the limit whole', () => {
    const box = new BBox(72.9, 26.1, 73.2, 26.4);
    expect(box.split(0.99)).toEqual([box]);
  });

  it('cuts a wide box into equal tiles under the limit that cover it exactly', () => {
    const tiles = new BBox(72, 26, 74.5, 27.2).split(0.99);
    expect(tiles).toHaveLength(6);
    for (const tile of tiles) for (const span of spans(tile)) expect(span).toBeLessThanOrEqual(0.99);
    expect(Math.min(...tiles.map((tile) => tile.minLon))).toBe(72);
    expect(Math.max(...tiles.map((tile) => tile.maxLat))).toBeCloseTo(27.2);
  });
});

describe('SiteTiles.plan', () => {
  it('loads a city view with one query, as before', () => {
    const plan = SiteTiles.plan(new BBox(72.9, 26.1, 73.2, 26.4));
    expect(plan.tiles).toHaveLength(1);
    expect(plan.partial).toBe(false);
  });

  it('tiles a view wider than 1 degree instead of loading only its centre', () => {
    const view = new BBox(72.5, 26, 76, 27.2);
    const plan = SiteTiles.plan(view);
    expect(plan.partial).toBe(false);
    expect(plan.loaded).toBe(view);
    expect(plan.tiles).toHaveLength(4 * 2);
    for (const tile of plan.tiles) expect(tile.toQuery().split(',').map(Number)).toHaveLength(4);
  });

  it('loads only the middle 4 by 4 tiles of a state-wide view and marks it partial', () => {
    const plan = SiteTiles.plan(new BBox(68, 22, 80, 30));
    expect(plan.partial).toBe(true);
    expect(plan.tiles).toHaveLength(16);
    expect(plan.loaded.center()).toEqual([74, 26]);
    for (const span of spans(plan.loaded)) expect(span).toBeCloseTo(3.96);
  });
});

describe('SiteTiles.merge', () => {
  const plan = SiteTiles.plan(new BBox(72, 26, 74, 27));

  it('keeps each site once, newest first', () => {
    const older = site('site_a', '2026-10-09T00:00:00Z');
    const newer = site('site_b', '2026-10-10T00:00:00Z');
    const merged = plan.merge([[older], [newer, older]]);
    expect(merged.sites.map((item) => item.properties.site_id)).toEqual(['site_b', 'site_a']);
    expect(merged.truncated).toBe(false);
  });

  it('drops rejected, removed and cleaned sites even if the API sends them', () => {
    const leaks = [
      site('site_r', '2026-10-10T00:00:00Z', { verification: 'rejected' }),
      site('site_x', '2026-10-10T00:00:00Z', { status: 'removed' }),
      site('site_c', '2026-10-10T00:00:00Z', { status: 'cleaned' }),
      site('site_ok', '2026-10-10T00:00:00Z', { status: 'reopened' }),
    ];
    expect(plan.merge([leaks]).sites.map((item) => item.properties.site_id)).toEqual(['site_ok']);
  });

  it('flags a query that came back at the 500 cap', () => {
    const full = Array.from({ length: SITES_PER_QUERY }, (_, index) => site(`site_${index}`, '2026-10-10T00:00:00Z'));
    expect(plan.merge([[], full]).truncated).toBe(true);
  });
});
