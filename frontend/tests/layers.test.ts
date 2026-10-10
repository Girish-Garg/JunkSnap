import { createExpression } from '@maplibre/maplibre-gl-style-spec';
import type { LayerSpecification } from 'maplibre-gl';
import { describe, expect, it } from 'vitest';
import type { MapMode } from '../src/domain/MapMode';
import HeatLayer from '../src/layers/HeatLayer';
import type { LayerContext } from '../src/layers/MapLayer';
import SelectedSiteLayer from '../src/layers/SelectedSiteLayer';
import SitesLayer from '../src/layers/SitesLayer';
import StackPinsLayer from '../src/layers/StackPinsLayer';

const context = (mode: MapMode, selectedId: string | null = null): LayerContext => ({ sourceId: 'sites', pinSourceId: 'site-pins', mode, selectedId });
type Section = 'paint' | 'layout';
const prop = (spec: LayerSpecification, section: Section, name: string): unknown =>
  (spec as unknown as Record<Section, Record<string, unknown> | undefined>)[section]?.[name];

function atZoom(expression: unknown, zoom: number): number {
  const parsed = createExpression(expression, 'layers[0].paint.opacity');
  if (parsed.result !== 'success') throw new Error('Invalid expression');
  return parsed.value.evaluate({ zoom }) as number;
}

describe('HeatLayer.spec', () => {
  const heat = new HeatLayer();

  it('fades out between zoom 11 and 12 in auto mode', () => {
    const opacity = prop(heat.spec(context('auto')), 'paint', 'heatmap-opacity');
    expect([atZoom(opacity, 10), atZoom(opacity, 11.5), atZoom(opacity, 12)]).toEqual([0.85, 0.425, 0]);
  });

  it('hides in pins mode and stays at full opacity in heat mode', () => {
    expect(prop(heat.spec(context('pins')), 'layout', 'visibility')).toBe('none');
    expect(prop(heat.spec(context('heat')), 'paint', 'heatmap-opacity')).toBe(0.85);
  });
});

describe('SitesLayer.spec', () => {
  const pins = new SitesLayer();

  it('fades pins in from zoom 11 to 12 in auto mode', () => {
    const spec = pins.spec(context('auto'));
    const opacity = prop(spec, 'paint', 'icon-opacity');
    expect(spec.minzoom).toBe(11);
    expect([atZoom(opacity, 11), atZoom(opacity, 11.5), atZoom(opacity, 12)]).toEqual([0, 0.5, 1]);
  });

  it('shows pins at every zoom in pins mode and hides them in heat mode', () => {
    expect(pins.spec(context('pins'))).toMatchObject({ minzoom: 0, paint: { 'icon-opacity': 1 } });
    expect(prop(pins.spec(context('heat')), 'layout', 'visibility')).toBe('none');
  });

  it('leaves the selected site to SelectedSiteLayer', () => {
    expect(pins.spec(context('auto', 'site_a'))).toMatchObject({
      filter: ['all', ['!', ['has', 'stack_count']], ['!=', ['get', 'site_id'], 'site_a']],
    });
  });
});

describe('SelectedSiteLayer.spec', () => {
  it('draws only the selected site, in every mode', () => {
    const layer = new SelectedSiteLayer();
    for (const mode of ['auto', 'pins', 'heat'] as const) {
      expect(layer.spec(context(mode, 'site_a'))).toMatchObject({ filter: ['==', ['get', 'site_id'], 'site_a'] });
    }
  });
});

describe('StackPinsLayer.spec', () => {
  const stacks = new StackPinsLayer();

  it('draws only stacks, from the pin source, with their count always shown', () => {
    const spec = stacks.spec(context('pins'));
    expect(spec).toMatchObject({ source: 'site-pins', filter: ['has', 'stack_count'], minzoom: 0 });
    expect(prop(spec, 'layout', 'icon-image')).toEqual(['get', 'stack_icon']);
    expect(prop(spec, 'layout', 'text-field')).toEqual(['to-string', ['get', 'stack_count']]);
    expect(prop(spec, 'layout', 'text-allow-overlap')).toBe(true);
  });

  it('fades in and hides like the lone pins', () => {
    const opacity = prop(stacks.spec(context('auto')), 'paint', 'icon-opacity');
    expect([atZoom(opacity, 11), atZoom(opacity, 12)]).toEqual([0, 1]);
    expect(prop(stacks.spec(context('heat')), 'layout', 'visibility')).toBe('none');
  });

  it('leaves stacks out of the lone pins, whose n/10 badges drop out rather than smear together', () => {
    const spec = new SitesLayer().spec(context('pins'));
    expect(spec).toMatchObject({ source: 'site-pins' });
    expect(prop(spec, 'layout', 'text-allow-overlap')).toBe(false);
  });
});
