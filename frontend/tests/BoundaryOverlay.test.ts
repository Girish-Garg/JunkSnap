import type { Map as MapLibreMap } from 'maplibre-gl';
import { describe, expect, it, vi } from 'vitest';
import { BoundaryOverlay, type BoundaryFiles } from '../src/features/map/BoundaryOverlay';

function fakeMap() {
  const sources = new Map<string, unknown>();
  const images = new Set<string>();
  const layers = new Set<string>();
  const map = {
    on: vi.fn(),
    hasImage: (name: string) => images.has(name),
    addImage: vi.fn((name: string) => images.add(name)),
    updateImage: vi.fn(),
    setLayoutProperty: vi.fn(),
    getLayer: (id: string) => (layers.has(id) ? { id } : undefined),
    addLayer: vi.fn((spec: { id: string }) => layers.add(spec.id)),
    removeLayer: vi.fn((id: string) => layers.delete(id)),
    getSource: (id: string) => (sources.has(id) ? { setData: vi.fn() } : undefined),
    addSource: vi.fn((id: string, spec: unknown) => sources.set(id, spec)),
    removeSource: vi.fn((id: string) => sources.delete(id)),
    getStyle: () => ({ layers: [] }),
    removeFeatureState: vi.fn(),
    setFeatureState: vi.fn(),
    getZoom: () => 12,
  };
  return { map, sources };
}

const files: BoundaryFiles = {
  polygonsUrl: () => '/b/areas.geojson',
  fineUrl: () => '/b/areas_fine.geojson',
  labels: async () => ({ type: 'FeatureCollection', features: [] }),
};

describe('BoundaryOverlay.show', () => {
  it('redraws when the fine edges or the credit change, and not when nothing changed', () => {
    const { map, sources } = fakeMap();
    const overlay = new BoundaryOverlay(map as unknown as MapLibreMap, files, undefined);
    overlay.ready();
    overlay.show({ fine: true });
    expect(sources.get('boundary-polygons')).toMatchObject({ data: '/b/areas.geojson', promoteId: 'id' });
    expect(sources.get('boundary-polygons')).toMatchObject({ attribution: expect.stringContaining('DataMeet') });
    const calls = map.addSource.mock.calls.length;
    overlay.show({ fine: true });
    expect(map.addSource.mock.calls.length).toBe(calls);
    overlay.show({ fine: true, attribution: 'Other seats' });
    expect(sources.get('boundary-polygons')).toMatchObject({ attribution: 'Other seats' });
    overlay.show(null);
    expect(sources.has('boundary-polygons')).toBe(false);
  });

  it('adds the plain, score and photo badge images once ready', () => {
    const { map } = fakeMap();
    new BoundaryOverlay(map as unknown as MapLibreMap, files, undefined).ready();
    expect(map.addImage.mock.calls.map(([name]) => name)).toEqual(['area-badge', 'area-badge-score', 'area-badge-count', 'area-glyph-count', 'area-glyph-pilot']);
  });
});

describe('BoundaryOverlay.setDark', () => {
  it('redraws the badges and the marker text in place when the theme turns dark', () => {
    const { map } = fakeMap();
    const overlay = new BoundaryOverlay(map as unknown as MapLibreMap, files, undefined);
    overlay.ready();
    overlay.show({ fine: false });
    overlay.setDark(true);
    expect(map.updateImage.mock.calls.map(([name]) => name)).toEqual(['area-badge', 'area-badge-score', 'area-badge-count', 'area-glyph-count', 'area-glyph-pilot']);
    expect(map.setLayoutProperty).toHaveBeenCalledWith('boundary-marker', 'text-field', expect.anything());
    overlay.setDark(true);
    expect(map.updateImage).toHaveBeenCalledTimes(5);
  });

  it('starts dark when the theme is dark before the map is ready', () => {
    const { map } = fakeMap();
    const overlay = new BoundaryOverlay(map as unknown as MapLibreMap, files, undefined);
    overlay.setDark(true);
    overlay.ready();
    overlay.show({ fine: false });
    expect(map.updateImage).not.toHaveBeenCalled();
    const [, firstBadge] = map.addImage.mock.calls[0] as unknown as [string, { data: Uint8Array; width: number; height: number }];
    const middle = (Math.floor(firstBadge.height / 2) * firstBadge.width + Math.floor(firstBadge.width / 2)) * 4;
    expect([...firstBadge.data.slice(middle, middle + 3)]).toEqual([42, 37, 30]);
  });
});
