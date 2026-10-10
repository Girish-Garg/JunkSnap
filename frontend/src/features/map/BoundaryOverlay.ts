import type { GeoJSONSource, Map as MapLibreMap, PointLike } from 'maplibre-gl';
import type { BoundaryKind } from '../../domain/AreaListing';
import { AreaMarkerLayer, BADGE_IMAGES } from '../../layers/boundaries/AreaMarkerLayer';
import { BoundaryFillLayer } from '../../layers/boundaries/BoundaryFillLayer';
import type { BoundaryContext, BoundaryLayer } from '../../layers/boundaries/BoundaryLayer';
import { BoundaryLineLayer } from '../../layers/boundaries/BoundaryLineLayer';
import { OutdatedLineLayer } from '../../layers/boundaries/OutdatedLineLayer';
import type { AreaMarker } from './AreaMarkers';
import { AreaMarkerSource, type LabelLoader } from './AreaMarkerSource';
import { BadgeArt } from './BadgeArt';
import type { BadgeKind } from './BadgeIcons';
import { MarkerTooltip } from './MarkerTooltip';

export interface BoundaryFiles extends LabelLoader {
  polygonsUrl(kind: BoundaryKind): string;
  fineUrl(kind: BoundaryKind): string;
}

export interface AreaHit {
  readonly kind: BoundaryKind;
  readonly id: string;
}

/** Which boundaries to draw; `fine` says the kind has an original-edge file for close zooms. */
export interface BoundaryView {
  readonly kind: BoundaryKind;
  readonly fine: boolean;
  /** The layer's own credit line; seat boundaries credit DataMeet and ECI by default. */
  readonly attribution?: string;
}

const LAYERS: readonly BoundaryLayer[] = [
  new BoundaryFillLayer(),
  new BoundaryLineLayer(),
  new OutdatedLineLayer(),
  new AreaMarkerLayer(),
];
const PICKABLE = ['boundary-marker', 'boundary-fill'];
const POLYGONS = 'boundary-polygons';
const LABELS = 'boundary-labels';
// Original edges load once the map is zoomed in past the city view.
export const FINE_MIN_ZOOM = 12;
// Licence terms in data/boundaries/SOURCES.md: CC BY 2.5 India for the Rajasthan seats, CC0 for the rest.
const SEAT_CREDIT =
  'Seat boundaries: <a href="https://github.com/datameet/maps">DataMeet</a> and the Election Commission of India (CC BY 2.5 IN)';

/** Area boundaries and markers of one kind under the site layers, filled by colour per area id (feature state). */
export class BoundaryOverlay {
  readonly #map: MapLibreMap;
  readonly #files: BoundaryFiles;
  /** The first site layer; markers go just below it. */
  readonly #siteLayerId: string | undefined;
  readonly #markers: AreaMarkerSource;
  #view: BoundaryView | null = null;
  #colors: ReadonlyMap<string, string> = new Map();
  #fineLoaded = false;
  #ready = false;

  constructor(map: MapLibreMap, files: BoundaryFiles, siteLayerId: string | undefined) {
    this.#map = map;
    this.#files = files;
    this.#siteLayerId = siteLayerId;
    this.#markers = new AreaMarkerSource(map, files, LABELS);
    map.on('zoomend', () => this.#loadFineEdges());
    new MarkerTooltip(map, 'boundary-marker');
  }

  /** Called once the style and the site layers are in. */
  ready(): void {
    this.#ready = true;
    for (const [kind, name] of Object.entries(BADGE_IMAGES) as [BadgeKind, string][]) {
      const badge = BadgeArt.create(kind);
      if (!this.#map.hasImage(name)) this.#map.addImage(name, badge, badge.options);
    }
    this.#render();
  }

  show(view: BoundaryView | null): void {
    if (BoundaryOverlay.#key(view) === BoundaryOverlay.#key(this.#view)) return;
    this.#view = view;
    this.#render();
  }

  static #key(view: BoundaryView | null): string {
    return view ? `${view.kind}|${String(view.fine)}|${view.attribution ?? ''}` : '';
  }

  paint(colors: ReadonlyMap<string, string>): void {
    this.#colors = colors;
    this.#applyColors();
  }

  label(markers: ReadonlyMap<string, AreaMarker>): void {
    this.#markers.setMarkers(markers);
  }

  /** A marker or an area under the tap. */
  pick(point: PointLike): AreaHit | null {
    const layers = PICKABLE.filter((id) => this.#map.getLayer(id));
    if (!this.#view || layers.length === 0) return null;
    const [hit] = this.#map.queryRenderedFeatures(point, { layers });
    const id: unknown = hit?.properties['id'];
    return typeof id === 'string' ? { kind: this.#view.kind, id } : null;
  }

  #render(): void {
    if (!this.#ready) return;
    this.#clear();
    if (!this.#view) return;
    const { kind, attribution } = this.#view;
    this.#fineLoaded = false;
    const polygons = { type: 'geojson', data: this.#files.polygonsUrl(kind), promoteId: 'id' } as const;
    this.#map.addSource(POLYGONS, { ...polygons, attribution: attribution ?? SEAT_CREDIT });
    this.#map.addSource(LABELS, { type: 'geojson', data: AreaMarkerSource.merge(null, new Map()) });
    const context: BoundaryContext = { kind, polygonSource: POLYGONS, labelSource: LABELS };
    const underLabels = this.#firstBasemapLabel();
    for (const layer of LAYERS) this.#map.addLayer(layer.spec(context), layer.onTop ? this.#siteLayer() : underLabels);
    this.#markers.load(kind);
    this.#applyColors();
    this.#loadFineEdges();
  }

  /** Swaps in the original edges once, the first time the map is closer than the city view. */
  #loadFineEdges(): void {
    if (!this.#view?.fine || this.#fineLoaded || this.#map.getZoom() <= FINE_MIN_ZOOM) return;
    const source = this.#map.getSource<GeoJSONSource>(POLYGONS);
    if (!source) return;
    this.#fineLoaded = true;
    source.setData(this.#files.fineUrl(this.#view.kind));
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
