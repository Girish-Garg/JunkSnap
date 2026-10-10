import type { Map as MapLibreMap } from 'maplibre-gl';
import { describe, expect, it, vi } from 'vitest';
import { BoundaryOverlay, type BoundaryFiles } from '../src/features/map/BoundaryOverlay';

function fakeMap() {
  const sources = new Map<string, unknown>();
  const map = {
    on: vi.fn(),
    hasImage: () => false,
    addImage: vi.fn(),
    getLayer: () => undefined,
    addLayer: vi.fn(),
    removeLayer: vi.fn(),
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
    expect(map.addImage.mock.calls.map(([name]) => name)).toEqual(['area-badge', 'area-badge-score', 'area-badge-count']);
  });
});
