import type { Map as MapLibreMap, PointLike } from 'maplibre-gl';
import type { BoundaryKind } from '../../domain/AreaListing';
import { BoundaryFillLayer } from '../../layers/boundaries/BoundaryFillLayer';
import type { BoundaryContext, BoundaryLayer } from '../../layers/boundaries/BoundaryLayer';
import { BoundaryLabelLayer } from '../../layers/boundaries/BoundaryLabelLayer';
import { BoundaryLineLayer } from '../../layers/boundaries/BoundaryLineLayer';
import { OutdatedLineLayer } from '../../layers/boundaries/OutdatedLineLayer';

export interface BoundaryUrls {
  polygonsUrl(kind: BoundaryKind): string;
  labelsUrl(kind: BoundaryKind): string;
}

export interface AreaHit {
  readonly kind: BoundaryKind;
  readonly id: string;
}

const LAYERS: readonly BoundaryLayer[] = [
  new BoundaryFillLayer(),
  new BoundaryLineLayer(),
  new OutdatedLineLayer(),
  new BoundaryLabelLayer(),
];
const POLYGONS = 'boundary-polygons';
const LABELS = 'boundary-labels';
// Licence terms in data/boundaries/SOURCES.md: CC BY 2.5 India for the Rajasthan seats, CC0 for the rest.
const SEAT_CREDIT =
  'Seat boundaries: <a href="https://github.com/datameet/maps">DataMeet</a> and the Election Commission of India (CC BY 2.5 IN)';

/** Area boundaries of one kind under the site layers, filled by colour per area id through feature state. */
export class BoundaryOverlay {
  readonly #map: MapLibreMap;
  readonly #urls: BoundaryUrls;
  /** The first site layer; boundary labels go just below it. */
  readonly #siteLayerId: string | undefined;
  #kind: BoundaryKind | null = null;
  #colors: ReadonlyMap<string, string> = new Map();
  #ready = false;

  constructor(map: MapLibreMap, urls: BoundaryUrls, siteLayerId: string | undefined) {
    this.#map = map;
    this.#urls = urls;
    this.#siteLayerId = siteLayerId;
  }

  /** Called once the style and the site layers are in. */
  ready(): void {
    this.#ready = true;
    this.#render();
  }

  show(kind: BoundaryKind | null): void {
    if (kind === this.#kind) return;
    this.#kind = kind;
    this.#render();
  }

  paint(colors: ReadonlyMap<string, string>): void {
    this.#colors = colors;
    this.#applyColors();
  }

  pick(point: PointLike): AreaHit | null {
    if (!this.#kind || !this.#map.getLayer('boundary-fill')) return null;
    const [hit] = this.#map.queryRenderedFeatures(point, { layers: ['boundary-fill'] });
    const id: unknown = hit?.properties['id'];
    return typeof id === 'string' ? { kind: this.#kind, id } : null;
  }

  #render(): void {
    if (!this.#ready) return;
    this.#clear();
    if (!this.#kind) return;
    const kind = this.#kind;
    const polygons = { type: 'geojson', data: this.#urls.polygonsUrl(kind), promoteId: 'id' } as const;
    this.#map.addSource(POLYGONS, { ...polygons, attribution: SEAT_CREDIT });
    this.#map.addSource(LABELS, { type: 'geojson', data: this.#urls.labelsUrl(kind) });
    const context: BoundaryContext = { kind, polygonSource: POLYGONS, labelSource: LABELS };
    const underLabels = this.#firstBasemapLabel();
    for (const layer of LAYERS) this.#map.addLayer(layer.spec(context), layer.onTop ? this.#siteLayer() : underLabels);
    this.#applyColors();
  }

  #clear(): void {
    for (const layer of LAYERS) if (this.#map.getLayer(layer.id)) this.#map.removeLayer(layer.id);
    for (const source of [POLYGONS, LABELS]) if (this.#map.getSource(source)) this.#map.removeSource(source);
  }

  #applyColors(): void {
    if (!this.#map.getSource(POLYGONS)) return;
    this.#map.removeFeatureState({ source: POLYGONS });
    for (const [id, fill] of this.#colors) this.#map.setFeatureState({ source: POLYGONS, id }, { fill });
  }

  #siteLayer(): string | undefined {
    return this.#siteLayerId && this.#map.getLayer(this.#siteLayerId) ? this.#siteLayerId : undefined;
  }

  // Fills and edges stay under the basemap's street and place names.
  #firstBasemapLabel(): string | undefined {
    const layers = this.#map.getStyle().layers;
    return layers.find((layer) => layer.type === 'symbol' && !layer.id.startsWith('site-'))?.id ?? this.#siteLayer();
  }
}
