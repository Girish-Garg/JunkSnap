import { createExpression } from '@maplibre/maplibre-gl-style-spec';
import type { ExpressionSpecification, StyleSpecification } from 'maplibre-gl';
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
    { id: 'label_other', type: 'symbol', source: 'openmaptiles', layout: { 'text-field': ['coalesce', ['get', 'name_en'], ['get', 'name']] } },
    { id: 'aeroway-runway', type: 'line', source: 'openmaptiles', paint: { 'line-color': 'rgba(255, 255, 255, 1)' } },
    { id: 'aeroway-area', type: 'fill', source: 'openmaptiles', paint: { 'fill-color': 'rgba(255, 255, 255, 1)' } },
    { id: 'railway_dashline', type: 'line', source: 'openmaptiles', paint: { 'line-color': '#fafafa' } },
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

describe('BasemapTheme on the dark map and with placeholder names', () => {
  const themed = new Map(BasemapTheme.apply(STYLE).layers.map((layer) => [layer.id, layer]));

  it('dims runways, aprons and rail dashes in the dark palette, so no white bar crosses the map', () => {
    const dark = new Map(BasemapTheme.apply(STYLE, true).layers.map((layer) => [layer.id, layer]));
    expect(dark.get('aeroway-runway')).toMatchObject({ paint: { 'line-color': '#2a251f' } });
    expect(dark.get('aeroway-area')).toMatchObject({ paint: { 'fill-color': '#2a251f' } });
    expect(dark.get('railway_dashline')).toMatchObject({ paint: { 'line-color': '#1d1a16' } });
    expect(BasemapTheme.paint({ id: 'aeroway-runway', type: 'line' }, true)).toEqual({ 'line-color': '#2a251f' });
  });

  // OSM node 1742590752 in Jodhpur is a suburb named "Nan", which the suburb labels print upper case as "NAN".
  it('drops labels whose name is an import placeholder such as nan, and keeps real names', () => {
    const field = (themed.get('label_other') as { layout: { 'text-field': ExpressionSpecification } }).layout['text-field'];
    const compiled = createExpression(field, 'layers[0].layout.text-field');
    if (compiled.result !== 'success') throw new Error('the guarded text-field does not compile');
    const text = (name: string) => compiled.value.evaluate({ zoom: 14 }, { type: 'Point', properties: { name }, geometry: [] } as never);
    expect(text('Nan')).toBe('');
    expect(text('NULL')).toBe('');
    expect(text('Nandwan')).toBe('Nandwan');
    expect(text('Ratanada')).toBe('Ratanada');
  });
});

// Vitest hands CSS imports back empty, so the stylesheet is read from disk (the app has no Node types).
type FileReader = { readFileSync(path: string, encoding: 'utf8'): string };
const fs = (await import('node:fs' as string)) as FileReader;
const tokensCss = fs.readFileSync('src/ui/tokens.css', 'utf8');

describe('the map area before the basemap arrives', () => {
  it("paints the basemap's own land colour, light and both dark blocks, so a slow load looks like a map", () => {
    const values = [...tokensCss.matchAll(/--map-bg: (#[0-9a-f]{6});/g)].map((match) => match[1]);
    const land = (dark: boolean) => BasemapTheme.paint({ id: 'background', type: 'background' }, dark)['background-color'];
    expect(values).toEqual([land(false), land(true), land(true)]);
  });
});
