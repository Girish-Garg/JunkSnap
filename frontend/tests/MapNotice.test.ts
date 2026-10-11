import { describe, expect, it } from 'vitest';
import { MapNotice, type MapNoticeInput } from '../src/features/map/MapNotice';

const CALM: MapNoticeInput = {
  online: true,
  failed: false,
  locationProblem: null,
  loaded: true,
  loadedCount: 3,
  shownCount: 3,
  clamped: false,
};
const keyFor = (patch: Partial<MapNoticeInput>) => MapNotice.pick({ ...CALM, ...patch })?.key ?? null;

describe('MapNotice.pick', () => {
  it('shows nothing when sites are on screen', () => {
    expect(keyFor({})).toBeNull();
  });

  it('puts offline first, then a failed load, then location problems', () => {
    expect(keyFor({ online: false, failed: true })).toBe('notice.offline');
    expect(keyFor({ failed: true, locationProblem: 'denied' })).toBe('notice.loadFailed');
    expect(keyFor({ locationProblem: 'unavailable' })).toBe('notice.locationUnavailable');
  });

  it('separates filtered-out, zoom-in and truly empty views', () => {
    expect(keyFor({ shownCount: 0 })).toBe('notice.filteredEmpty');
    expect(keyFor({ loadedCount: 0, shownCount: 0, clamped: true })).toBe('notice.zoomIn');
    expect(keyFor({ loadedCount: 0, shownCount: 0 })).toBe('notice.empty');
  });

  it('says when a query hit the 500 cap instead of showing a silently cut list', () => {
    expect(keyFor({ truncated: true })).toBe('notice.capped');
    expect(keyFor({ truncated: true, clamped: true })).toBe('notice.zoomIn');
  });

});

describe('MapNotice.pick for an empty view', () => {
  it('never says "no reports" while sites lie just off screen, or while still looking for them', () => {
    const empty = { loadedCount: 0, shownCount: 0 };
    expect(MapNotice.pick({ ...CALM, ...empty, nearby: true })).toMatchObject({ key: 'notice.offScreen', action: 'nearest' });
    expect(keyFor({ ...empty, nearby: null })).toBeNull();
    expect(keyFor({ ...empty, nearby: false })).toBe('notice.empty');
  });

  it('stays quiet before the first load', () => {
    expect(keyFor({ loaded: false, loadedCount: 0, shownCount: 0 })).toBeNull();
  });
});

describe('MapNotice.pick for the basemap', () => {
  it('says nothing before 600 ms, once drawn, or without a map', () => {
    for (const basemap of ['idle', 'loading', 'loaded'] as const) expect(keyFor({ basemap })).toBeNull();
  });

  it('comes after offline; its Try again comes before a failed site load, its waits after', () => {
    expect(keyFor({ basemap: 'failed', online: false })).toBe('notice.offline');
    expect(keyFor({ basemap: 'failed', failed: true })).toBe('notice.mapFailed');
    expect(keyFor({ basemap: 'slow', failed: true })).toBe('notice.loadFailed');
    expect(MapNotice.pick({ ...CALM, basemap: 'failed', locationProblem: 'denied' })).toMatchObject({ key: 'notice.mapFailed', tone: 'alert', action: 'retryMap' });
    expect(MapNotice.pick({ ...CALM, basemap: 'slow', clamped: true })).toMatchObject({ key: 'notice.mapSlow', action: 'mapless', busy: true });
    expect(MapNotice.pick({ ...CALM, basemap: 'waiting', loadedCount: 0, shownCount: 0 })).toMatchObject({ key: 'notice.mapLoading', busy: true });
  });
});

// Vitest hands CSS imports back empty, so the stylesheets are read from disk (the app has no Node types).
type FileReader = { readFileSync(path: string, encoding: 'utf8'): string };
const fs = (await import('node:fs' as string)) as FileReader;
const rule = (file: string, selector: string) => {
  const css = fs.readFileSync(file, 'utf8');
  const at = css.indexOf(`\n${selector} {`);
  return at < 0 ? '' : css.slice(at, css.indexOf('}', at));
};

// A 360 px phone cut "Only the middle of this wide view is loaded…" off at the screen edge (one unwrapped line).
describe('the toast and the legend hint on a narrow phone', () => {
  it('keeps the toast inside its column and wraps a long line to three lines at most', () => {
    expect(rule('src/features/map/map.css', '.map-status')).toContain('max-width: 100%;');
    const text = rule('src/features/map/map.css', '.map-status .notice__text');
    expect(text).toContain('-webkit-line-clamp: 3;');
    expect(text).not.toContain('nowrap');
  });

  it('puts the legend hint above its chip when the two do not fit side by side', () => {
    expect(rule('src/features/map/boundaries.css', '.legend-toggle__row')).toContain('flex-wrap: wrap-reverse;');
    expect(rule('src/features/map/boundaries.css', '.legend-toggle__chip')).toContain('flex: none;');
  });
});
