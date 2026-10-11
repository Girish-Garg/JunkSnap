import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TargetMap } from '../src/features/snap/TargetMap';
import { DEFAULTS } from './config';
import { created } from './fakeMapLibre';

vi.mock('maplibre-gl', () => import('./fakeMapLibre'));

interface LineData {
  readonly geometry: { readonly coordinates: number[][] };
}

const ORIGIN = { lat: 26.26183, lon: 73.00352 };
const labels = {
  attribution: 'Map credits',
  you: 'You are here',
  pin: 'The waste',
  twoFingers: 'Use two fingers to move the map',
  ctrlScroll: 'Use Ctrl + scroll to zoom the map',
  cmdScroll: 'Use ⌘ + scroll to zoom the map',
};

function create() {
  const moves: { lat: number; lon: number }[] = [];
  const map = new TargetMap({ container: document.createElement('div'), origin: ORIGIN, labels, onMove: (point) => moves.push(point), settings: DEFAULTS.map });
  const [you, pin] = created.markers;
  const [seen] = created.maps;
  if (!you || !pin || !seen) throw new Error('TargetMap made no map or markers');
  const line = (id: string) => (seen.sources.get(id)?.data as LineData | undefined)?.geometry.coordinates;
  return { map, moves, seen, pin, you, line };
}

beforeEach(() => {
  created.maps.length = 0;
  created.markers.length = 0;
});

describe('TargetMap pin and taps', () => {
  it('centres on the reporter with a fixed dot and a draggable pin, both named', () => {
    const { you, pin } = create();
    expect(you.lngLat).toEqual([ORIGIN.lon, ORIGIN.lat]);
    expect(you.options.draggable).toBeUndefined();
    expect(pin.options.draggable).toBe(true);
    expect(pin.options.element.getAttribute('aria-label')).toBe('The waste');
  });

  it('reports where the pin was dropped after a drag', () => {
    const { pin, moves } = create();
    pin.lngLat = [73.005, 26.263];
    pin.handlers.get('dragend')?.();
    expect(moves).toEqual([{ lat: 26.263, lon: 73.005 }]);
  });

  it('leaves one-finger drags to the sheet: two fingers move the map, with the hint in the UI language', () => {
    const { seen } = create();
    expect(seen.options.cooperativeGestures).toBe(true);
    expect(seen.options.locale?.['CooperativeGesturesHandler.MobileHelpText']).toBe('Use two fingers to move the map');
  });

  it('reports a tap on the map', () => {
    const { seen, moves } = create();
    seen.handlers.get('click')?.({ lngLat: { lat: 26.262, lng: 73.004 } });
    expect(moves).toEqual([{ lat: 26.262, lon: 73.004 }]);
  });
});

describe('TargetMap drawing', () => {
  it('moves the pin to the placement and draws the line to it and the heading line once loaded', () => {
    const { map, seen, pin, line } = create();
    const spot = { lat: 26.263, lon: 73.005 };
    map.show(spot, { lat: 26.264, lon: 73.00352 });
    expect(pin.lngLat).toEqual([73.005, 26.263]);
    seen.handlers.get('load')?.();
    expect(seen.layers.map((layer) => layer.id)).toEqual(['target-line', 'heading-line']);
    expect(line('target-line')).toEqual([[ORIGIN.lon, ORIGIN.lat], [73.005, 26.263]]);
    expect(line('heading-line')).toEqual([[ORIGIN.lon, ORIGIN.lat], [73.00352, 26.264]]);
    map.show(spot, null);
    expect(line('heading-line')).toEqual([]);
  });

  it('removes the map when destroyed', () => {
    const { map, seen } = create();
    map.destroy();
    expect(seen.removed).toBe(true);
  });
});
