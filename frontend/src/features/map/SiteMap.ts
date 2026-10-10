import { AttributionControl, LngLatBounds, Map as MapLibreMap, Marker, type GeoJSONSource } from 'maplibre-gl';
import { BBox } from '../../domain/BBox';
import type { MapMode } from '../../domain/MapMode';
import type { LonLat, SiteFeature } from '../../domain/Site';
import type { LayerRegistry } from '../../layers/LayerRegistry';
import type { AreaMarker } from './AreaMarkers';
import { BasemapMode } from './BasemapMode';
import { BoundaryOverlay, type AreaHit, type BoundaryFiles, type BoundaryView } from './BoundaryOverlay';
import { PinFeatures } from './PinFeatures';
import { PinGroups } from './PinGroups';
import { PinPicker } from './PinPicker';
import { PinDrop } from './PinDrop';
import { SelectedPulse } from './SelectedPulse';

// OpenFreeMap needs no key; its style carries the OpenStreetMap credit for the attribution control.
const STYLE_URL = 'https://tiles.openfreemap.org/styles/positron';
const JODHPUR: [number, number] = [73.02, 26.27];
// MapLibre zooms use 512 px tiles (one below Google Maps); 12 shows about 6 km across a phone.
const CITY_ZOOM = 12;
const SITE_ZOOM = 14;
// OpenFreeMap tiles stop at 14 and are overzoomed; past 18 a phone shows a few metres of plain background.
const MAX_ZOOM = 18;
const INDIA_BOUNDS: [[number, number], [number, number]] = [[60, 4], [100, 38.5]];
const SOURCE_ID = 'sites';
const PIN_SOURCE_ID = 'site-pin-groups';
// GET /sites allows 1 by 1 degree; stay under it after rounding.
const MAX_QUERY_SPAN_DEG = 0.99;
// Must match DESKTOP_QUERY in ui/useMediaQuery.ts: the map then sits beside the side panel, not under it.
const DESKTOP_QUERY = '(min-width: 1024px)';

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
  /** A tap on a pin that stands for several sites at one spot. */
  readonly onPickStack: (siteIds: readonly string[]) => void;
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
  readonly #basemap: BasemapMode;
  #userMarker: Marker | null = null;
  readonly #boundaries: BoundaryOverlay;
  readonly #pulse: SelectedPulse;
  readonly #drop: PinDrop;
  readonly #groups = new PinGroups();
  readonly #picker: PinPicker;

  constructor(options: SiteMapOptions) {
    this.#layers = options.layers;
    this.#map = new MapLibreMap({
      container: options.container,
      center: JODHPUR,
      zoom: CITY_ZOOM,
      minZoom: 4,
      maxZoom: MAX_ZOOM,
      maxBounds: INDIA_BOUNDS,
      attributionControl: false,
      locale: { 'AttributionControl.ToggleAttribution': options.attributionLabel },
    });
    this.#pulse = new SelectedPulse(this.#map);
    this.#drop = new PinDrop(this.#map);
    this.#picker = new PinPicker(this.#map, this.#layers);
    this.#map.addControl(new AttributionControl({ compact: true }), 'bottom-left');
    this.#basemap = new BasemapMode(this.#map);
    this.#map.setStyle(STYLE_URL, { transformStyle: (_previous, next) => this.#basemap.transform(next) });
    this.#boundaries = new BoundaryOverlay(this.#map, options.boundaries, this.#layers.all()[0]?.id);
    this.#listen(options);
  }

  showSites(sites: readonly SiteFeature[]): void {
    this.#sites = sites;
    this.#source(SOURCE_ID)?.setData(PinFeatures.sites(sites));
    this.#refreshPins();
    this.#showPulse();
    this.#drop.play(this.#layers.interactiveIds(), sites.length);
  }

  select(siteId: string | null): void {
    this.#selectedId = siteId;
    this.#renderLayers();
    this.#showPulse();
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

  /** Switches the basemap between its light and dark colours in place, keeping the site layers. */
  setDark(dark: boolean): void {
    this.#basemap.setDark(dark);
    this.#boundaries.setDark(dark);
  }

  showUser(position: LonLat): void {
    this.#userMarker ??= new Marker({ element: SiteMap.#userDot() });
    this.#userMarker.setLngLat([...position]).addTo(this.#map);
    this.moveTo([position]);
  }

  destroy(): void {
    this.#map.remove();
  }

  #listen({ onPick, onPickStack, onPickArea, onViewChange }: SiteMapOptions): void {
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
    // Pins that overlap at one zoom stand apart at another, so the stacks follow the zoom.
    this.#map.on('zoomend', () => this.#refreshPins());
    this.#map.on('click', (event) => {
      const hit = this.#picker.at(event.point);
      const area = hit === null ? this.#boundaries.pick(event.point) : null;
      if (area) onPickArea(area);
      else if (hit?.kind === 'stack') onPickStack(hit.siteIds);
      else onPick(hit?.siteId ?? null);
    });
    for (const id of this.#layers.interactiveIds()) {
      this.#map.on('mouseenter', id, () => this.#setCursor('pointer'));
      this.#map.on('mouseleave', id, () => this.#setCursor(''));
    }
  }

  async #addSiteLayers(): Promise<void> {
    await Promise.all(this.#layers.all().map((layer) => layer.prepare?.(this.#map)));
    this.#map.addSource(SOURCE_ID, { type: 'geojson', data: PinFeatures.sites(this.#sites) });
    this.#map.addSource(PIN_SOURCE_ID, { type: 'geojson', data: this.#pins() });
    this.#ready = true;
    this.#renderLayers();
    this.#boundaries.ready();
    this.#drop.play(this.#layers.interactiveIds(), this.#sites.length);
  }

  // Layers describe themselves from mode and selection; re-adding three layers is cheap.
  #renderLayers(): void {
    if (!this.#ready) return;
    const context = { sourceId: SOURCE_ID, pinSourceId: PIN_SOURCE_ID, mode: this.#mode, selectedId: this.#selectedId };
    for (const layer of this.#layers.all()) {
      if (this.#map.getLayer(layer.id)) this.#map.removeLayer(layer.id);
    }
    for (const layer of this.#layers.all()) this.#map.addLayer(layer.spec(context));
  }

  #clearOffset(): [number, number] {
    if (window.matchMedia(DESKTOP_QUERY).matches) return [0, 0];
    return [0, -Math.round(this.#map.getContainer().clientHeight * 0.2)];
  }

  #source(id: string): GeoJSONSource | undefined {
    return this.#map.getSource<GeoJSONSource>(id);
  }

  #refreshPins(): void {
    this.#source(PIN_SOURCE_ID)?.setData(this.#pins());
  }

  #pins() {
    return PinFeatures.pins(this.#groups.of(this.#sites, this.#map.getZoom()));
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

  #showPulse(): void {
    const site = this.#sites.find((item) => item.properties.site_id === this.#selectedId);
    this.#pulse.show(site ? site.geometry.coordinates : null);
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
