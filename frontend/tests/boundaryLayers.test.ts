import { createExpression } from '@maplibre/maplibre-gl-style-spec';
import type { LayerSpecification } from 'maplibre-gl';
import { describe, expect, it } from 'vitest';
import { AREA_TINTS } from '../src/layers/boundaries/AreaTints';
import { BoundaryFillLayer } from '../src/layers/boundaries/BoundaryFillLayer';
import { FocusLineLayer } from '../src/layers/boundaries/FocusLineLayer';
import { AreaMarkerLayer, BADGE_IMAGES, INLINE_IMAGES, markerText as markerTextFor } from '../src/layers/boundaries/AreaMarkerLayer';
import type { BoundaryContext } from '../src/layers/boundaries/BoundaryLayer';
import { BoundaryLineLayer } from '../src/layers/boundaries/BoundaryLineLayer';
import { OutdatedLineLayer } from '../src/layers/boundaries/OutdatedLineLayer';

const context = (): BoundaryContext => ({ polygonSource: 'polys', labelSource: 'labels', dark: false });
type Section = 'paint' | 'layout';
const prop = (spec: LayerSpecification, section: Section, name: string): unknown =>
  (spec as unknown as Record<Section, Record<string, unknown> | undefined>)[section]?.[name];
const filterOf = (spec: LayerSpecification): unknown => (spec as { filter?: unknown }).filter;

function matches(filter: unknown, status: string): boolean {
  const parsed = createExpression(filter, { type: 'boolean' } as never);
  if (parsed.result !== 'success') throw new Error('Invalid filter');
  const feature = { type: 'Polygon', properties: { status } } as never;
  return parsed.value.evaluate({ zoom: 12 }, feature) as boolean;
}

function atZoom(expression: unknown, zoom: number): number {
  const parsed = createExpression(expression, 'layers[0].paint.opacity');
  if (parsed.result !== 'success') throw new Error('Invalid expression');
  return parsed.value.evaluate({ zoom }) as number;
}

// Evaluates a paint expression for one area with the given feature state.
function withState(expression: unknown, state: Record<string, unknown>, zoom = 12): unknown {
  const parsed = createExpression(expression, 'layers[0].paint.value');
  if (parsed.result !== 'success') throw new Error('Invalid expression');
  return parsed.value.evaluate({ zoom }, { type: 'Polygon', properties: {} } as never, state as never);
}

// Untyped evaluation returns colours as written in the expression.
const colour = (value: string): string => value;

describe('BoundaryFillLayer', () => {
  const spec = new BoundaryFillLayer().spec(context());
  const fill = prop(spec, 'paint', 'fill-color');

  it('tints each area by its neighbour slot, and is transparent before the polygons are read', () => {
    expect(spec).toMatchObject({ type: 'fill', source: 'polys' });
    expect(withState(fill, { tint: 0 })).toEqual(colour(AREA_TINTS.light[0]));
    expect(withState(fill, { tint: 7 })).toEqual(colour(AREA_TINTS.light[7]));
    expect(withState(fill, {})).toEqual(colour('rgba(0, 0, 0, 0)'));
  });

  it('shows the score colour over the tint once the api shows a score, more strongly', () => {
    const opacity = prop(spec, 'paint', 'fill-opacity');
    expect(withState(fill, { tint: 2, fill: '#e2786a', scored: true })).toEqual(colour('#e2786a'));
    expect(withState(opacity, { scored: true }, 10)).toBe(0.55);
    // A neighbour tint stays light: about 10 to 15%.
    for (const zoom of [5, 10, 12, 15, 18]) {
      expect(withState(opacity, { tint: 2 }, zoom)).toBeGreaterThanOrEqual(0.1);
      expect(withState(opacity, { tint: 2 }, zoom)).toBeLessThanOrEqual(0.15);
    }
  });

});

describe('BoundaryFillLayer zoom and theme', () => {
  const spec = new BoundaryFillLayer().spec(context());

  it('lightens as the map zooms into streets', () => {
    const opacity = prop(spec, 'paint', 'fill-opacity');
    expect(withState(opacity, { scored: true }, 10)).toBeGreaterThan(withState(opacity, { scored: true }, 15) as number);
  });

  it('uses the dark tints in the dark theme, and swaps them in place', () => {
    const dark = new BoundaryFillLayer().spec({ ...context(), dark: true });
    expect(withState(prop(dark, 'paint', 'fill-color'), { tint: 0 })).toEqual(colour(AREA_TINTS.dark[0]));
    expect(new BoundaryFillLayer().themed(true).paint?.[0]?.[0]).toBe('fill-color');
  });
});

describe('FocusLineLayer', () => {
  const spec = new FocusLineLayer().spec(context());

  it('draws a thick accent outline only round the area in focus', () => {
    const opacity = prop(spec, 'paint', 'line-opacity');
    expect(withState(opacity, { focus: true })).toBe(1);
    expect(withState(opacity, { focus: false })).toBe(0);
    expect(withState(opacity, {})).toBe(0);
    expect(atZoom(prop(spec, 'paint', 'line-width'), 12)).toBeGreaterThan(atZoom(prop(new BoundaryLineLayer().spec(context()), 'paint', 'line-width'), 12));
    expect(prop(spec, 'paint', 'line-color')).toBe('#0b7a73');
    expect(prop(new FocusLineLayer().spec({ ...context(), dark: true }), 'paint', 'line-color')).toBe('#3cc7b8');
  });
});

describe('boundary lines', () => {
  const current = new BoundaryLineLayer().spec(context());
  const outdated = new OutdatedLineLayer().spec(context());

  it('draws current seats solid and outdated seats dashed and grey, each once', () => {
    expect([matches(filterOf(current), 'current'), matches(filterOf(current), 'outdated')]).toEqual([true, false]);
    expect([matches(filterOf(outdated), 'current'), matches(filterOf(outdated), 'outdated')]).toEqual([false, true]);
    expect(prop(current, 'paint', 'line-dasharray')).toBeUndefined();
    expect(prop(outdated, 'paint', 'line-dasharray')).toEqual([2, 2]);
    expect(prop(outdated, 'paint', 'line-color')).toBe('#9aa0a6');
  });

  it('draws areas without a status (wards, assembly seats) as current', () => {
    expect(matches(filterOf(current), '')).toBe(true);
  });

  it('is clearly visible at the city view', () => {
    const width = prop(current, 'paint', 'line-width');
    expect(atZoom(width, 12)).toBeGreaterThanOrEqual(1.5);
    expect(atZoom(width, 5)).toBeLessThan(1);
  });
});

interface Formatted {
  readonly sections: readonly { readonly text: string; readonly image: { readonly name: string } | null }[];
}

function formatted(spec: LayerSpecification, properties: Record<string, unknown>): Formatted {
  const parsed = createExpression(prop(spec, 'layout', 'text-field'), { type: 'formatted' } as never);
  if (parsed.result !== 'success') throw new Error('Invalid text-field');
  const feature = { type: 'Point', properties } as never;
  return parsed.value.evaluate({ zoom: 12 }, feature) as Formatted;
}

const markerText = (spec: LayerSpecification, properties: Record<string, unknown>): string =>
  formatted(spec, properties).sections.map((section) => section.text).join('').trimEnd();

const markerImages = (spec: LayerSpecification, properties: Record<string, unknown>): string[] =>
  formatted(spec, properties).sections.flatMap((section) => (section.image ? [section.image.name] : []));

describe('AreaMarkerLayer', () => {
  const marker = new AreaMarkerLayer();

  it('shows markers from the marker points once seats are a fair size on screen', () => {
    expect(marker.spec(context())).toMatchObject({ type: 'symbol', source: 'labels', minzoom: 8 });
  });

  it('is a badge around the name and the value, or the name alone', () => {
    const spec = marker.spec(context());
    expect(prop(spec, 'layout', 'icon-image')).toEqual(['match', ['get', 'marker_basis'], 'score', BADGE_IMAGES.score, 'count', BADGE_IMAGES.count, BADGE_IMAGES.plain]);
    expect(prop(spec, 'layout', 'icon-text-fit')).toBe('both');
    expect(markerText(spec, { name: 'Jodhpur', marker_value: '44' })).toBe('Jodhpur\n44');
    expect(markerText(spec, { name: 'Sardarpura' })).toBe('Sardarpura');
  });

  it('puts the verified report count beside a shown score, and the pilot flag on pilot-city data', () => {
    const spec = marker.spec(context());
    const scored = { name: 'Jodhpur', marker_value: '44', marker_count: '14' };
    expect(markerText(spec, scored)).toBe('Jodhpur\n44  14');
    expect(markerImages(spec, scored)).toEqual([INLINE_IMAGES.count]);
    expect(markerImages(spec, { ...scored, marker_pilot: true })).toEqual([INLINE_IMAGES.count, INLINE_IMAGES.pilot]);
    expect(markerImages(spec, { name: 'Sardarpura', marker_value: '4' })).toEqual([]);
  });
});

describe('AreaMarkerLayer placement', () => {
  const marker = new AreaMarkerLayer();

  it('avoids collisions, placing the worst areas first, and grows with zoom', () => {
    const spec = marker.spec(context());
    expect(prop(spec, 'layout', 'text-allow-overlap')).toBe(false);
    expect(prop(spec, 'layout', 'icon-allow-overlap')).toBe(false);
    expect(prop(spec, 'layout', 'symbol-sort-key')).toEqual(['coalesce', ['get', 'marker_rank'], 9999]);
    const size = prop(spec, 'layout', 'text-size');
    expect(atZoom(size, 15)).toBeGreaterThan(atZoom(size, 9));
  });

  it('sits above the basemap labels while fills and lines sit under them', () => {
    expect(marker.onTop).toBe(true);
    expect([new BoundaryFillLayer(), new BoundaryLineLayer(), new OutdatedLineLayer()].map((layer) => layer.onTop)).toEqual([false, false, false]);
  });
});

describe('AreaMarkerLayer in the dark theme', () => {
  const colours = (expression: unknown): unknown[] => JSON.stringify(expression).match(/#[0-9a-f]{6}/g) ?? [];

  it('uses light text on the dark badge, and dark text on the light one', () => {
    const [name, value] = ['#221c15', '#5f5446'];
    expect(colours(markerTextFor(false))).toEqual([name, value, value, name, value, value, name, value, name]);
    expect(colours(markerTextFor(true))).toEqual(['#f7f0e4', '#c9bdaa', '#c9bdaa', '#f7f0e4', '#c9bdaa', '#c9bdaa', '#f7f0e4', '#c9bdaa', '#f7f0e4']);
    const dark = new AreaMarkerLayer().spec({ polygonSource: 'polys', labelSource: 'labels', dark: true });
    expect(prop(dark, 'layout', 'text-field')).toEqual(markerTextFor(true));
  });
});

describe('AreaMarkerLayer for the area in focus', () => {
  it('always shows the focused area marker, from a state-wide zoom, and none while nothing is in focus', () => {
    const focus = new AreaMarkerLayer(true).spec(context());
    expect(focus).toMatchObject({ id: 'boundary-marker-focus', minzoom: 5 });
    expect(prop(focus, 'layout', 'text-allow-overlap')).toBe(true);
    expect(prop(focus, 'layout', 'icon-allow-overlap')).toBe(true);
    expect(filterOf(focus)).toEqual(['==', ['get', 'id'], '']);
    expect(filterOf(new AreaMarkerLayer().spec(context()))).toEqual(['!=', ['get', 'id'], '']);
  });
});
