import { createExpression } from '@maplibre/maplibre-gl-style-spec';
import type { LayerSpecification } from 'maplibre-gl';
import { describe, expect, it } from 'vitest';
import { BoundaryFillLayer } from '../src/layers/boundaries/BoundaryFillLayer';
import { AreaMarkerLayer, BADGE_IMAGES, markerText as markerTextFor } from '../src/layers/boundaries/AreaMarkerLayer';
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

describe('BoundaryFillLayer', () => {
  it('takes its colour from feature state and is transparent without one', () => {
    const spec = new BoundaryFillLayer().spec(context());
    expect(spec).toMatchObject({ type: 'fill', source: 'polys' });
    expect(prop(spec, 'paint', 'fill-color')).toEqual(['coalesce', ['feature-state', 'fill'], 'rgba(0, 0, 0, 0)']);
  });

  it('lightens as the map zooms into streets', () => {
    const opacity = prop(new BoundaryFillLayer().spec(context()), 'paint', 'fill-opacity');
    expect(atZoom(opacity, 10)).toBeGreaterThan(atZoom(opacity, 15));
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

function markerText(spec: LayerSpecification, properties: Record<string, unknown>): string {
  const parsed = createExpression(prop(spec, 'layout', 'text-field'), { type: 'formatted' } as never);
  if (parsed.result !== 'success') throw new Error('Invalid text-field');
  const feature = { type: 'Point', properties } as never;
  const formatted = parsed.value.evaluate({ zoom: 12 }, feature) as { sections: { text: string }[] };
  return formatted.sections.map((section) => section.text).join('');
}

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
    expect(colours(markerTextFor(false))).toEqual(['#221c15', '#5f5446', '#221c15']);
    expect(colours(markerTextFor(true))).toEqual(['#f7f0e4', '#c9bdaa', '#f7f0e4']);
    const dark = new AreaMarkerLayer().spec({ polygonSource: 'polys', labelSource: 'labels', dark: true });
    expect(prop(dark, 'layout', 'text-field')).toEqual(markerTextFor(true));
  });
});
