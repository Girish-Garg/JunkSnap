import type { LayerSpecification, StyleSpecification } from 'maplibre-gl';
import { PlaceholderNames } from './PlaceholderNames';

type Properties = Record<string, unknown>;

interface Palette {
  readonly land: string;
  readonly park: string;
  readonly water: string;
  readonly building: string;
  readonly buildingEdge: string;
  readonly casing: string;
  readonly road: string;
  readonly subtle: string;
  readonly boundary: string;
  readonly label: string;
  readonly halo: string;
}

// Warm sandstone by day; warm charcoal by night. Reports stay the only strong colour in both.
const LIGHT: Palette = {
  land: '#f3ede2', park: '#dcefd6', water: '#bfe2ee', building: '#ebe3d5', buildingEdge: '#e0d5c4',
  casing: '#e5dccd', road: '#fffaf1', subtle: '#ebe3d6', boundary: '#c9bead', label: '#6b5f4f', halo: '#fffaf1',
};

const DARK: Palette = {
  land: '#1d1a16', park: '#1f2a1d', water: '#1a3440', building: '#29241e', buildingEdge: '#312b24',
  casing: '#2a251f', road: '#3a332a', subtle: '#2a251f', boundary: '#5a5146', label: '#c9bdaa', halo: '#1d1a16',
};

interface Rule {
  readonly match: RegExp;
  readonly paint?: (palette: Palette, type: LayerSpecification['type']) => Properties;
  readonly hide?: boolean;
}

// Line and fill layers of one feature class (aeroway, piers) take the same colour under their own property.
const tint = (color: (palette: Palette) => string) => (palette: Palette, type: LayerSpecification['type']) =>
  type === 'fill' ? { 'fill-color': color(palette) } : { 'line-color': color(palette) };

// Rules for OpenFreeMap Positron layer ids: a quiet base so report pins are the only colour.
const RULES: readonly Rule[] = [
  { match: /^background$/, paint: (p) => ({ 'background-color': p.land }) },
  { match: /^park$/, paint: (p) => ({ 'fill-color': p.park, 'fill-opacity': 0.6 }) },
  { match: /^landcover_wood$/, paint: (p) => ({ 'fill-color': p.park, 'fill-opacity': 0.4 }) },
  { match: /^landuse_residential$/, hide: true },
  { match: /^water$/, paint: (p) => ({ 'fill-color': p.water }) },
  { match: /^waterway$/, paint: (p) => ({ 'line-color': p.water }) },
  { match: /^building$/, paint: (p) => ({ 'fill-color': p.building, 'fill-outline-color': p.buildingEdge }) },
  { match: /_casing$/, paint: (p) => ({ 'line-color': p.casing }) },
  { match: /^(tunnel_motorway_inner|highway_(minor|path|major_inner|motorway_inner|motorway_bridge_inner))$/, paint: (p) => ({ 'line-color': p.road }) },
  { match: /_subtle$/, paint: (p) => ({ 'line-color': p.subtle }) },
  { match: /^railway(_transit|_service)?$/, paint: (p) => ({ 'line-color': p.casing }) },
  // Positron paints these near white, which glares as bars across the dark map (the Jodhpur runway).
  { match: /^railway.*_dashline$/, paint: (p) => ({ 'line-color': p.land }) },
  { match: /^aeroway-/, paint: tint((p) => p.subtle) },
  { match: /^road_(area_)?pier$/, paint: tint((p) => p.land) },
  { match: /^boundary/, paint: (p) => ({ 'line-color': p.boundary }) },
  { match: /shield/, hide: true },
];

export class BasemapTheme {
  /** Used as MapLibre's transformStyle, so the stock colours never reach the screen. */
  static apply(style: StyleSpecification, dark = false): StyleSpecification {
    return { ...style, layers: style.layers.map((layer) => BasemapTheme.#restyle(layer, dark)) };
  }

  /** Only the paint this theme sets for one basemap layer; SiteMap uses it to switch light and dark in place. */
  static paint(layer: Pick<LayerSpecification, 'id' | 'type'>, dark: boolean): Properties {
    const palette = dark ? DARK : LIGHT;
    const rule = RULES.find(({ match }) => match.test(layer.id));
    const label = layer.type === 'symbol' ? { 'text-color': palette.label, 'text-halo-color': palette.halo, 'text-halo-width': 1.5 } : {};
    return { ...label, ...rule?.paint?.(palette, layer.type) };
  }

  static #restyle(layer: LayerSpecification, dark: boolean): LayerSpecification {
    const rule = RULES.find(({ match }) => match.test(layer.id));
    const paint = { ...('paint' in layer ? layer.paint : {}), ...BasemapTheme.paint(layer, dark) };
    const layout = BasemapTheme.#layout(layer, rule?.hide === true);
    return { ...layer, paint, ...(layout ? { layout } : {}) } as LayerSpecification;
  }

  // Hidden layers; and labels that never print an OSM placeholder name such as "Nan" (PlaceholderNames).
  static #layout(layer: LayerSpecification, hide: boolean): Properties | undefined {
    const layout: Properties = { ...('layout' in layer ? layer.layout : {}) };
    if (hide) return { ...layout, visibility: 'none' };
    if (layer.type !== 'symbol' || layout['text-field'] === undefined) return undefined;
    return { ...layout, 'text-field': PlaceholderNames.guard(layout['text-field']) };
  }
}
