import type { GeoJSONSource, Map as MapLibreMap, PointLike } from 'maplibre-gl';
import { AreaMarkerLayer, BADGE_IMAGES, INLINE_IMAGES, markerFilter } from '../../layers/boundaries/AreaMarkerLayer';
import { BoundaryFillLayer } from '../../layers/boundaries/BoundaryFillLayer';
import type { BoundaryContext, BoundaryLayer } from '../../layers/boundaries/BoundaryLayer';
import { BoundaryLineLayer } from '../../layers/boundaries/BoundaryLineLayer';
import { FocusLineLayer } from '../../layers/boundaries/FocusLineLayer';
import { OutdatedLineLayer } from '../../layers/boundaries/OutdatedLineLayer';
import type { MapAreaKind } from '../../services/BoundaryCatalog';
import type { AreaMarker } from './AreaMarkers';
import { AreaMarkerSource, type LabelLoader } from './AreaMarkerSource';
import { AreaStates } from './AreaStates';
import { BadgeArt } from './BadgeArt';
import type { BadgeKind, InlineGlyph } from './BadgeIcons';
import { MarkerTooltip } from './MarkerTooltip';

const KINDS: readonly unknown[] = ['assembly', 'loksabha'] satisfies MapAreaKind[];

export interface BoundaryFiles extends LabelLoader {
  polygonsUrl(): string;
  fineUrl(): string;
}

/** An area under a tap: its own kind (assembly seat or Lok Sabha seat), id and name. */
export interface AreaHit {
  readonly kind: MapAreaKind;
  readonly id: string;
  readonly name: string;
}

/** How to draw the areas; `fine` says there is an original-edge file for close zooms. */
export interface BoundaryView {
  readonly fine: boolean;
  /** The layer's own credit line; seat boundaries credit DataMeet and ECI by default. */
  readonly attribution?: string;
}

const MARKERS = new AreaMarkerLayer();
const FOCUS_MARKER = new AreaMarkerLayer(true);
const LAYERS: readonly BoundaryLayer[] = [
  new BoundaryFillLayer(),
  new BoundaryLineLayer(),
  new OutdatedLineLayer(),
  new FocusLineLayer(),
  MARKERS,
  FOCUS_MARKER,
];
const PICKABLE = [FOCUS_MARKER.id, MARKERS.id, 'boundary-fill'];
const POLYGONS = 'boundary-polygons';
const LABELS = 'boundary-labels';
// Original edges load once the map is zoomed in past the city view.
export const FINE_MIN_ZOOM = 12;
// Licence terms in data/boundaries/SOURCES.md: CC BY 2.5 India for the Rajasthan seats, CC0 for the rest.
const SEAT_CREDIT =
  'Seat boundaries: <a href="https://github.com/datameet/maps">DataMeet</a> and the Election Commission of India (CC BY 2.5 IN)';

/**
 * The map's areas (assembly seats where they exist, Lok Sabha seats elsewhere) and their markers under the
 * site layers: each area tinted apart from its neighbours, or coloured by its shown score, through feature
 * state; the area in focus gets a thick outline and a marker that is always shown.
 */
export class BoundaryOverlay {
  readonly #map: MapLibreMap;
  readonly #files: BoundaryFiles;
  /** The first site layer; markers go just below it. */
  readonly #siteLayerId: string | undefined;
  readonly #markers: AreaMarkerSource;
  readonly #states: AreaStates;
  #view: BoundaryView | null = null;
  #fineLoaded = false;
  #ready = false;
  #dark = false;

  constructor(map: MapLibreMap, files: BoundaryFiles, siteLayerId: string | undefined) {
    this.#map = map;
    this.#files = files;
    this.#siteLayerId = siteLayerId;
    this.#markers = new AreaMarkerSource(map, files, LABELS);
    this.#states = new AreaStates(map, POLYGONS);
    map.on('zoomend', () => this.#loadFineEdges());
    new MarkerTooltip(map, MARKERS.id);
  }

  /** Called once the style and the site layers are in. */
  ready(): void {
    this.#ready = true;
    this.#drawBadges();
    this.#render();
  }

  /** Dark badges, light text and the dark tints in the dark theme, switched in place like the basemap. */
  setDark(dark: boolean): void {
    if (dark === this.#dark) return;
    this.#dark = dark;
    if (!this.#ready) return;
    this.#drawBadges();
    for (const layer of LAYERS) this.#restyle(layer, dark);
  }

  #restyle(layer: BoundaryLayer, dark: boolean): void {
    const themed = layer.themed?.(dark);
    if (!themed || !this.#map.getLayer(layer.id)) return;
    for (const [name, value] of themed.paint ?? []) this.#map.setPaintProperty(layer.id, name, value);
    for (const [name, value] of themed.layout ?? []) this.#map.setLayoutProperty(layer.id, name, value);
  }

  #drawBadges(): void {
    for (const [kind, name] of Object.entries(BADGE_IMAGES) as [BadgeKind, string][]) {
      const badge = BadgeArt.create(kind, this.#dark);
      if (this.#map.hasImage(name)) this.#map.updateImage(name, badge);
      else this.#map.addImage(name, badge, badge.options);
    }
    for (const [kind, name] of Object.entries(INLINE_IMAGES) as [InlineGlyph, string][]) {
      const glyph = BadgeArt.inline(kind, this.#dark);
      if (this.#map.hasImage(name)) this.#map.updateImage(name, glyph);
      else this.#map.addImage(name, glyph, glyph.options);
    }
  }

  show(view: BoundaryView | null): void {
    if (BoundaryOverlay.#key(view) === BoundaryOverlay.#key(this.#view)) return;
    this.#view = view;
    this.#render();
  }

  static #key(view: BoundaryView | null): string {
    return view ? `${String(view.fine)}|${view.attribution ?? ''}` : '';
  }

  /** Score colours of the areas that show a score. */
  paint(colors: ReadonlyMap<string, string>): void {
    this.#states.paint(colors);
  }

  /** Neighbour tint slots of every area. */
  tint(tints: ReadonlyMap<string, number>): void {
    this.#states.tint(tints);
  }

  /** The area to outline and label, or null. */
  focus(id: string | null): void {
    if (this.#states.setFocus(id)) this.#filterMarkers();
  }

  label(markers: ReadonlyMap<string, AreaMarker>): void {
    this.#markers.setMarkers(markers);
  }

  /** A marker or an area under the tap. */
  pick(point: PointLike): AreaHit | null {
    const layers = PICKABLE.filter((id) => this.#map.getLayer(id));
    if (!this.#view || layers.length === 0) return null;
    const [hit] = this.#map.queryRenderedFeatures(point, { layers });
    const { id, kind, name } = hit?.properties ?? {};
    if (typeof id !== 'string' || !KINDS.includes(kind)) return null;
    return { kind: kind as MapAreaKind, id, name: typeof name === 'string' ? name : id };
  }

  #render(): void {
    if (!this.#ready) return;
    this.#clear();
    if (!this.#view) return;
    const { attribution } = this.#view;
    this.#fineLoaded = false;
    const polygons = { type: 'geojson', data: this.#files.polygonsUrl(), promoteId: 'id' } as const;
    this.#map.addSource(POLYGONS, { ...polygons, attribution: attribution ?? SEAT_CREDIT });
    this.#map.addSource(LABELS, { type: 'geojson', data: AreaMarkerSource.merge(null, new Map()) });
    const context: BoundaryContext = { polygonSource: POLYGONS, labelSource: LABELS, dark: this.#dark };
    const underLabels = this.#firstBasemapLabel();
    for (const layer of LAYERS) this.#map.addLayer(layer.spec(context), layer.onTop ? this.#siteLayer() : underLabels);
    this.#markers.load();
    this.#states.apply();
    this.#filterMarkers();
    this.#loadFineEdges();
  }

  /** The focus marker shows the area in focus alone; the others leave it out so it is never drawn twice. */
  #filterMarkers(): void {
    const focus = this.#states.focus;
    if (this.#map.getLayer(MARKERS.id)) this.#map.setFilter(MARKERS.id, markerFilter(false, focus));
    if (this.#map.getLayer(FOCUS_MARKER.id)) this.#map.setFilter(FOCUS_MARKER.id, markerFilter(true, focus));
  }

  /** Swaps in the original edges once, the first time the map is closer than the city view. */
  #loadFineEdges(): void {
    if (!this.#view?.fine || this.#fineLoaded || this.#map.getZoom() <= FINE_MIN_ZOOM) return;
    const source = this.#map.getSource<GeoJSONSource>(POLYGONS);
    if (!source) return;
    this.#fineLoaded = true;
    source.setData(this.#files.fineUrl());
    this.#states.apply();
  }

  #clear(): void {
    for (const layer of LAYERS) if (this.#map.getLayer(layer.id)) this.#map.removeLayer(layer.id);
    for (const source of [POLYGONS, LABELS]) if (this.#map.getSource(source)) this.#map.removeSource(source);
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
