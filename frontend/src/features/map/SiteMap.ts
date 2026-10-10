import type { Feature, FeatureCollection } from 'geojson';
import { AttributionControl, LngLatBounds, Map as MapLibreMap, Marker, type GeoJSONSource, type Point } from 'maplibre-gl';
import { BBox } from '../../domain/BBox';
import { HeatWeight } from '../../domain/HeatWeight';
import type { MapMode } from '../../domain/MapMode';
import type { LonLat, SiteFeature } from '../../domain/Site';
import type { LayerRegistry } from '../../layers/LayerRegistry';
import { BasemapTheme } from './BasemapTheme';
import type { AreaMarker } from './AreaMarkers';
import { BoundaryOverlay, type AreaHit, type BoundaryFiles, type BoundaryView } from './BoundaryOverlay';

// OpenFreeMap needs no key; its style carries the OpenStreetMap credit for the attribution control.
const STYLE_URL = 'https://tiles.openfreemap.org/styles/positron';
const JODHPUR: [number, number] = [73.02, 26.27];
// MapLibre zooms use 512 px tiles (one below Google Maps); 12 shows about 6 km across a phone.
const CITY_ZOOM = 12;
const SITE_ZOOM = 14;
const INDIA_BOUNDS: [[number, number], [number, number]] = [[60, 4], [100, 38.5]];
const SOURCE_ID = 'sites';
const TAP_TOLERANCE_PX = 16;
// GET /sites allows 1 by 1 degree; stay under it after rounding.
const MAX_QUERY_SPAN_DEG = 0.99;
// Must match the desktop .sheet rules in ui/sheet.css.
const DESKTOP_QUERY = '(min-width: 768px)';
const SIDE_PANEL_PX = 400;

export interface MapView {
  readonly bbox: BBox;
  /** The view is wider than one API query, so only its centre is loaded. */
  readonly clamped: boolean;
}

export interface SiteMapOptions {
  readonly container: HTMLElement;
  readonly layers: LayerRegistry;
  /** Accessible name of the attribution toggle, in the UI language at creation. */
  readonly attributionLabel: string;
  /** A site id, or null when the tap hit empty map. */
  readonly onPick: (siteId: string | null) => void;
  /** A tap that hit no site but an area of the boundary layer shown. */
  readonly onPickArea: (area: AreaHit) => void;
  readonly boundaries: BoundaryFiles;
  readonly onViewChange: (view: MapView) => void;
}

export class SiteMap {
  readonly #map: MapLibreMap;
  readonly #layers: LayerRegistry;
  #sites: readonly SiteFeature[] = [];
  #selectedId: string | null = null;
  #mode: MapMode = 'auto';
  #ready = false;
  #userMarker: Marker | null = null;
  readonly #boundaries: BoundaryOverlay;

  constructor(options: SiteMapOptions) {
    this.#layers = options.layers;
    this.#map = new MapLibreMap({
      container: options.container,
      center: JODHPUR,
      zoom: CITY_ZOOM,
      minZoom: 4,
      maxBounds: INDIA_BOUNDS,
      attributionControl: false,
      locale: { 'AttributionControl.ToggleAttribution': options.attributionLabel },
    });
    this.#map.addControl(new AttributionControl({ compact: true }), 'bottom-left');
    this.#map.setStyle(STYLE_URL, { transformStyle: (_previous, next) => BasemapTheme.apply(next) });
    this.#boundaries = new BoundaryOverlay(this.#map, options.boundaries, this.#layers.all()[0]?.id);
    this.#listen(options);
  }

  showSites(sites: readonly SiteFeature[]): void {
    this.#sites = sites;
    this.#source()?.setData(this.#collection());
  }

  select(siteId: string | null): void {
    this.#selectedId = siteId;
    this.#renderLayers();
  }

  showBoundaries(view: BoundaryView | null): void {
    this.#boundaries.show(view);
  }

  /** Area id to the value its marker shows under its name. */
  labelAreas(markers: ReadonlyMap<string, AreaMarker>): void {
    this.#boundaries.label(markers);
  }

  /** Area id to fill colour for the boundary kind shown. */
  paintAreas(colors: ReadonlyMap<string, string>): void {
    this.#boundaries.paint(colors);
  }

  setMode(mode: MapMode): void {
    this.#mode = mode;
    this.#renderLayers();
  }

  /** One point: fly there, clear of the sheet or card. Several: fit them all. */
  moveTo(points: readonly LonLat[]): void {
    const [first] = points;
    if (!first) return;
    if (points.length === 1) {
      this.#map.flyTo({ center: [...first], zoom: Math.max(this.#map.getZoom(), SITE_ZOOM), offset: this.#clearOffset() });
      return;
    }
    const bounds = points.reduce((box, point) => box.extend([...point]), new LngLatBounds([...first], [...first]));
    this.#map.fitBounds(bounds, { padding: 80, maxZoom: SITE_ZOOM });
  }

  /** MapLibre reads its locale once; this keeps the attribution toggle in the UI language. */
  setAttributionLabel(label: string): void {
    const toggle = this.#map.getContainer().querySelector('.maplibregl-ctrl-attrib-button');
    toggle?.setAttribute('title', label);
    toggle?.setAttribute('aria-label', label);
  }

  showUser(position: LonLat): void {
    this.#userMarker ??= new Marker({ element: SiteMap.#userDot() });
    this.#userMarker.setLngLat([...position]).addTo(this.#map);
    this.moveTo([position]);
  }

  destroy(): void {
    this.#map.remove();
  }

  #listen({ onPick, onPickArea, onViewChange }: SiteMapOptions): void {
    // A zero-size container gives an empty box; the resize that follows fires moveend with the real one.
    const emitView = () => {
      if (this.#map.getContainer().clientHeight > 0) onViewChange(this.#view());
    };
    this.#map.on('load', () => {
      this.#collapseAttribution();
      this.#addSiteLayers()
        .then(emitView)
        .catch((error: unknown) => console.error('Could not add site layers', error));
    });
    this.#map.on('moveend', emitView);
    this.#map.on('click', (event) => {
      const siteId = this.#pick(event.point);
      const area = siteId === null ? this.#boundaries.pick(event.point) : null;
      if (area) onPickArea(area);
      else onPick(siteId);
    });
    for (const id of this.#layers.interactiveIds()) {
      this.#map.on('mouseenter', id, () => this.#setCursor('pointer'));
      this.#map.on('mouseleave', id, () => this.#setCursor(''));
    }
  }

  async #addSiteLayers(): Promise<void> {
    await Promise.all(this.#layers.all().map((layer) => layer.prepare?.(this.#map)));
    this.#map.addSource(SOURCE_ID, { type: 'geojson', data: this.#collection() });
    this.#ready = true;
    this.#renderLayers();
    this.#boundaries.ready();
  }

  // Layers describe themselves from mode and selection; re-adding three layers is cheap.
  #renderLayers(): void {
    if (!this.#ready) return;
    const context = { sourceId: SOURCE_ID, mode: this.#mode, selectedId: this.#selectedId };
    for (const layer of this.#layers.all()) {
      if (this.#map.getLayer(layer.id)) this.#map.removeLayer(layer.id);
    }
    for (const layer of this.#layers.all()) this.#map.addLayer(layer.spec(context));
  }

  #pick(point: Point): string | null {
    const box: [[number, number], [number, number]] = [
      [point.x - TAP_TOLERANCE_PX, point.y - TAP_TOLERANCE_PX],
      [point.x + TAP_TOLERANCE_PX, point.y + TAP_TOLERANCE_PX],
    ];
    const layers = this.#layers.interactiveIds().filter((id) => this.#map.getLayer(id));
    const [hit] = this.#map.queryRenderedFeatures(box, { layers });
    const siteId: unknown = hit?.properties['site_id'];
    return typeof siteId === 'string' ? siteId : null;
  }

  #clearOffset(): [number, number] {
    if (window.matchMedia(DESKTOP_QUERY).matches) return [SIDE_PANEL_PX / 2, 0];
    return [0, -Math.round(this.#map.getContainer().clientHeight * 0.2)];
  }

  #source(): GeoJSONSource | undefined {
    return this.#map.getSource<GeoJSONSource>(SOURCE_ID);
  }

  #collection(): FeatureCollection {
    // Nested properties do not reach MapLibre expressions, so the heat weight is added flat.
    const features = this.#sites.map((site) => ({
      ...site,
      properties: { ...site.properties, heat_weight: HeatWeight.of(site.properties) },
    }));
    // MapLibre types want mutable GeoJSON but it only reads it.
    return { type: 'FeatureCollection', features: features as unknown as Feature[] };
  }

  #view(): MapView {
    const bounds = this.#map.getBounds();
    const view = new BBox(bounds.getWest(), bounds.getSouth(), bounds.getEast(), bounds.getNorth());
    return { bbox: view.clampedTo(MAX_QUERY_SPAN_DEG), clamped: view.isWiderThan(MAX_QUERY_SPAN_DEG) };
  }

  // Compact attribution opens expanded; start as the small "i" and let a tap expand it.
  #collapseAttribution(): void {
    const control = this.#map.getContainer().querySelector('.maplibregl-ctrl-attrib');
    control?.classList.remove('maplibregl-compact-show');
    control?.removeAttribute('open');
  }

  #setCursor(cursor: string): void {
    this.#map.getCanvas().style.cursor = cursor;
  }

  static #userDot(): HTMLElement {
    const dot = document.createElement('span');
    dot.className = 'user-dot';
    return dot;
  }
}
