import { Map as MapLibreMap } from 'maplibre-gl';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BasemapWatch, type BasemapSignal } from '../src/features/map/BasemapWatch';
import { SiteMap } from '../src/features/map/SiteMap';
import { LayerRegistry } from '../src/layers/LayerRegistry';
import { made } from './fakeBasemap';

vi.mock('maplibre-gl', () => import('./fakeBasemap'));

const STYLE = 'https://tiles.openfreemap.org/styles/positron';

function watched() {
  const signals: BasemapSignal[] = [];
  const watch = new BasemapWatch(new MapLibreMap({ container: document.createElement('div') }), STYLE, (signal) => signals.push(signal));
  watch.start();
  return { map: made.at(-1)!, signals, watch };
}

beforeEach(() => {
  made.length = 0;
});

describe('BasemapWatch', () => {
  it('reports a load from its start to the first full paint, once', () => {
    const { map, signals } = watched();
    map.emit('load');
    map.emit('idle');
    expect(signals).toEqual(['loading', 'loaded']);
  });

  it('ends a reload after the first paint at the next idle, as MapLibre fires load only once', () => {
    const { map, signals, watch } = watched();
    map.emit('load');
    watch.start();
    map.emit('idle');
    expect(signals).toEqual(['loading', 'loaded', 'loading', 'loaded']);
  });
});

// A listener on 'error' stops MapLibre's own console.error, so the watch logs what does not fail the load.
const logged = () => vi.spyOn(console, 'error').mockImplementation(() => undefined);

afterEach(() => {
  vi.restoreAllMocks();
});

describe('BasemapWatch failures', () => {
  it('fails on the style fetch, and only logs a tile, another source or the sprite', () => {
    const log = logged();
    const { map, signals } = watched();
    const others = [{ message: 'Failed to fetch' }, { message: 'Not found' }, { message: 'Failed to fetch', url: 'https://tiles.openfreemap.org/sprites/ofm' }];
    map.emit('error', { error: others[0], sourceId: 'openmaptiles', tile: {} });
    map.emit('error', { error: others[1], sourceId: 'area-polygons' });
    map.emit('error', { error: others[2] });
    expect(signals).toEqual(['loading']);
    expect(log.mock.calls).toEqual(others.map((error) => [error]));
    map.emit('error', { error: { message: 'Failed to fetch', url: STYLE } });
    expect(signals).toEqual(['loading', 'failed']);
    expect(log).toHaveBeenCalledTimes(3);
  });

  it("stays failed when the basemap source's TileJSON fails and MapLibre then draws an empty map", () => {
    const { map, signals } = watched();
    map.emit('error', { error: { message: 'Failed to fetch' }, sourceId: 'openmaptiles' });
    map.emit('load');
    expect(signals).toEqual(['loading', 'failed']);
  });
});

describe('BasemapWatch with a style that is not JSON', () => {
  // A captive portal answers 200 with its own HTML page: MapLibre's JSON parse throws a SyntaxError with no url.
  const notJson = { error: { name: 'SyntaxError', message: "Unexpected token '<'" } };

  it('fails the load when the error comes before the style is read', () => {
    const { map, signals } = watched();
    map.emit('error', notJson);
    expect(signals).toEqual(['loading', 'failed']);
  });

  it('only logs such an error once the style is read, and fails again on the next style', () => {
    const log = logged();
    const { map, signals, watch } = watched();
    map.emit('style.load');
    map.emit('error', notJson);
    expect(signals).toEqual(['loading']);
    expect(log).toHaveBeenCalledWith(notJson.error);
    watch.start();
    map.emit('styledataloading');
    map.emit('error', notJson);
    expect(signals).toEqual(['loading', 'loading', 'failed']);
  });
});

const boundaries = { polygonsUrl: () => '/a.geojson', fineUrl: () => '/b.geojson', labels: async () => ({ type: 'FeatureCollection' as const, features: [] }) };
const ignore = () => undefined;

function siteMap(signals: BasemapSignal[]) {
  const options = { container: document.createElement('div'), layers: new LayerRegistry([]), attributionLabel: 'Map credits', boundaries };
  const created = new SiteMap({ ...options, onPick: ignore, onPickStack: ignore, onPickArea: ignore, onViewChange: ignore, onBasemap: (signal) => signals.push(signal) });
  return { siteMap: created, map: made.at(-1)! };
}

describe('SiteMap.reloadBasemap', () => {
  it('drops a style that never came (setStyle would wait on it forever) and fetches it again', () => {
    const signals: BasemapSignal[] = [];
    const { siteMap: created, map } = siteMap(signals);
    map.emit('error', { error: { message: 'Failed to fetch', url: STYLE } });
    created.reloadBasemap();
    expect(map.setStyle.mock.calls.map(([style]) => style)).toEqual([STYLE, null, STYLE]);
    map.emit('idle');
    expect(signals).toEqual(['loading', 'failed', 'loading', 'loaded']);
  });

  it('keeps a style that came and fetches only its failed basemap source again', () => {
    const { siteMap: created, map } = siteMap([]);
    const source = { load: vi.fn(async () => undefined) };
    Object.assign(map, { getSource: (id: string) => (id === 'openmaptiles' ? source : undefined) });
    created.reloadBasemap();
    expect(source.load).toHaveBeenCalledOnce();
    expect(map.setStyle).toHaveBeenCalledOnce();
  });
});
