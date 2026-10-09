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

  it('stays quiet before the first load', () => {
    expect(keyFor({ loaded: false, loadedCount: 0, shownCount: 0 })).toBeNull();
  });
});
