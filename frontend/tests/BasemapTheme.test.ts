import type { StyleSpecification } from 'maplibre-gl';
import { describe, expect, it } from 'vitest';
import { BasemapTheme } from '../src/features/map/BasemapTheme';

const STYLE: StyleSpecification = {
  version: 8,
  sources: {},
  layers: [
    { id: 'background', type: 'background', paint: { 'background-color': '#f2f3f0' } },
    { id: 'water', type: 'fill', source: 'openmaptiles', paint: { 'fill-color': '#c2c8ca' } },
    { id: 'landuse_residential', type: 'fill', source: 'openmaptiles', paint: {} },
    { id: 'highway-shield-non-us', type: 'symbol', source: 'openmaptiles', layout: {} },
    { id: 'label_city', type: 'symbol', source: 'openmaptiles', paint: { 'text-color': '#000' } },
  ],
};

describe('BasemapTheme', () => {
  const themed = new Map(BasemapTheme.apply(STYLE).layers.map((layer) => [layer.id, layer]));

  it('recolours land and water to the calm palette', () => {
    expect(themed.get('background')).toMatchObject({ paint: { 'background-color': '#f3ede2' } });
    expect(themed.get('water')).toMatchObject({ paint: { 'fill-color': '#bfe2ee' } });
  });

  it('hides landuse fills and road shields', () => {
    expect(themed.get('landuse_residential')).toMatchObject({ layout: { visibility: 'none' } });
    expect(themed.get('highway-shield-non-us')).toMatchObject({ layout: { visibility: 'none' } });
  });

  it('turns labels grey with a white halo', () => {
    expect(themed.get('label_city')).toMatchObject({ paint: { 'text-color': '#6b5f4f', 'text-halo-color': '#fffaf1' } });
  });
});
