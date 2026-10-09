import type { LayerSpecification, StyleSpecification } from 'maplibre-gl';

type Properties = Record<string, unknown>;

interface Rule {
  readonly match: RegExp;
  readonly paint?: Properties;
  readonly hide?: boolean;
}

// Rules for OpenFreeMap Positron layer ids: a quiet base so report pins are the only colour.
const RULES: readonly Rule[] = [
  { match: /^background$/, paint: { 'background-color': '#f4f4f2' } },
  { match: /^park$/, paint: { 'fill-color': '#e3eee0', 'fill-opacity': 0.6 } },
  { match: /^landcover_wood$/, paint: { 'fill-color': '#e3eee0', 'fill-opacity': 0.4 } },
  { match: /^landuse_residential$/, hide: true },
  { match: /^water$/, paint: { 'fill-color': '#cfe3f3' } },
  { match: /^waterway$/, paint: { 'line-color': '#cfe3f3' } },
  { match: /^building$/, paint: { 'fill-color': '#ecebe8', 'fill-outline-color': '#e2e1dd' } },
  { match: /_casing$/, paint: { 'line-color': '#e2e2e2' } },
  { match: /^highway_(minor|path|major_inner|motorway_inner|motorway_bridge_inner)$/, paint: { 'line-color': '#ffffff' } },
  { match: /_subtle$/, paint: { 'line-color': '#e8e8e6' } },
  { match: /^railway(_transit|_service)?$/, paint: { 'line-color': '#e2e2e2' } },
  { match: /^boundary/, paint: { 'line-color': '#c4c7c5' } },
  { match: /shield/, hide: true },
];

const LABEL_PAINT: Properties = { 'text-color': '#5f6368', 'text-halo-color': '#ffffff', 'text-halo-width': 1.5 };

export class BasemapTheme {
  /** Used as MapLibre's transformStyle, so the stock colours never reach the screen. */
  static apply(style: StyleSpecification): StyleSpecification {
    return { ...style, layers: style.layers.map((layer) => BasemapTheme.#restyle(layer)) };
  }

  static #restyle(layer: LayerSpecification): LayerSpecification {
    const rule = RULES.find(({ match }) => match.test(layer.id));
    const labelPaint = layer.type === 'symbol' ? LABEL_PAINT : {};
    const paint = { ...('paint' in layer ? layer.paint : {}), ...labelPaint, ...rule?.paint };
    const layout = rule?.hide ? { ...('layout' in layer ? layer.layout : {}), visibility: 'none' } : undefined;
    return { ...layer, paint, ...(layout ? { layout } : {}) } as LayerSpecification;
  }
}
