import { createExpression } from '@maplibre/maplibre-gl-style-spec';
import type { LayerSpecification } from 'maplibre-gl';
import { describe, expect, it } from 'vitest';
import type { BoundaryKind } from '../src/domain/AreaListing';
import { BoundaryFillLayer } from '../src/layers/boundaries/BoundaryFillLayer';
import { BoundaryLabelLayer } from '../src/layers/boundaries/BoundaryLabelLayer';
import type { BoundaryContext } from '../src/layers/boundaries/BoundaryLayer';
import { BoundaryLineLayer } from '../src/layers/boundaries/BoundaryLineLayer';
import { OutdatedLineLayer } from '../src/layers/boundaries/OutdatedLineLayer';

const context = (kind: BoundaryKind): BoundaryContext => ({ kind, polygonSource: 'polys', labelSource: 'labels' });
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
    const spec = new BoundaryFillLayer().spec(context('assembly'));
    expect(spec).toMatchObject({ type: 'fill', source: 'polys' });
    expect(prop(spec, 'paint', 'fill-color')).toEqual(['coalesce', ['feature-state', 'fill'], 'rgba(0, 0, 0, 0)']);
  });

  it('lightens as the map zooms into streets', () => {
    const opacity = prop(new BoundaryFillLayer().spec(context('assembly')), 'paint', 'fill-opacity');
    expect(atZoom(opacity, 10)).toBeGreaterThan(atZoom(opacity, 15));
  });
});

describe('boundary lines', () => {
  const current = new BoundaryLineLayer().spec(context('loksabha'));
  const outdated = new OutdatedLineLayer().spec(context('loksabha'));

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

describe('BoundaryLabelLayer', () => {
  it('names areas from the label points only at higher zooms, later for smaller areas', () => {
    const label = new BoundaryLabelLayer();
    expect(label.spec(context('loksabha'))).toMatchObject({ type: 'symbol', source: 'labels', minzoom: 7 });
    expect(label.spec(context('assembly')).minzoom).toBe(10);
    expect(label.spec(context('ward')).minzoom).toBe(13);
    expect(prop(label.spec(context('ward')), 'layout', 'text-field')).toEqual(['get', 'name']);
  });

  it('sits above the basemap labels while fills and lines sit under them', () => {
    expect(new BoundaryLabelLayer().onTop).toBe(true);
    expect([new BoundaryFillLayer(), new BoundaryLineLayer(), new OutdatedLineLayer()].map((layer) => layer.onTop)).toEqual([false, false, false]);
  });
});
