import { AttributionControl, LngLatBounds, Map as MapLibreMap, Marker, type GeoJSONSource } from 'maplibre-gl';
import type { MapSettings } from '../../config/MapSettings';
import { BBox } from '../../domain/BBox';
import type { MapMode } from '../../domain/MapMode';
import type { LonLat, SiteFeature } from '../../domain/Site';
import type { LayerRegistry } from '../../layers/LayerRegistry';
import type { AreaMarker } from './AreaMarkers';
import { BasemapMode } from './BasemapMode';
import { BoundaryOverlay, type AreaHit, type BoundaryFiles, type BoundaryView } from './BoundaryOverlay';
import { FitPadding } from './FitPadding';
import { PinFeatures } from './PinFeatures';
import { PinGroups } from './PinGroups';
import { PinPicker } from './PinPicker';
import { PinDrop } from './PinDrop';
import { SelectedPulse } from './SelectedPulse';

// The style (OpenFreeMap needs no key) carries the OpenStreetMap credit for the attribution control. MapLibre zooms
// use 512 px tiles (one below Google Maps). Both, the bounds and the pilot city the map opens on, are MapSettings.
const SOURCE_ID = 'sites';
const PIN_SOURCE_ID = 'site-pin-groups';
// Must match DESKTOP_QUERY in ui/useMediaQuery.ts: the map then sits beside the side panel, not under it.
const DESKTOP_QUERY = '(min-width: 1024px)';

export interface MapView {
  /** What the map shows; domain/SiteTiles turns it into GET /sites queries. */
  readonly bbox: BBox;
  /** The person moved the map (drag, pinch, wheel), not the app. */
  readonly byUser?: boolean;
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
  /** The style, the opening view and the zooms (the config's map settings). */
  readonly settings: MapSettings;
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
  readonly #settings: MapSettings;

  constructor(options: SiteMapOptions) {
    const { settings } = options;
    this.#layers = options.layers;
    this.#settings = settings;
    this.#map = new MapLibreMap({
      container: options.container,
      // Always the pilot city first; a location fix shows the dot but never moves the map on its own.
      center: [...settings.pilotCentre],
      zoom: settings.pilotZoom,
      minZoom: settings.minZoom,
      maxZoom: settings.maxZoom,
      maxBounds: [[settings.maxBounds.minLon, settings.maxBounds.minLat], [settings.maxBounds.maxLon, settings.maxBounds.maxLat]],
      attributionControl: false,
      locale: { 'AttributionControl.ToggleAttribution': options.attributionLabel },
    });
    this.#pulse = new SelectedPulse(this.#map);
    this.#drop = new PinDrop(this.#map);
    this.#picker = new PinPicker(this.#map, this.#layers);
    this.#map.addControl(new AttributionControl({ compact: true }), 'bottom-left');
    this.#basemap = new BasemapMode(this.#map);
    this.#map.setStyle(settings.styleUrl, { transformStyle: (_previous, next) => this.#basemap.transform(next) });
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

  /** Area id to score colour, for the areas that show a score. */
  paintAreas(colors: ReadonlyMap<string, string>): void {
    this.#boundaries.paint(colors);
  }

  /** Area id to neighbour tint slot, for every area. */
  tintAreas(tints: ReadonlyMap<string, number>): void {
    this.#boundaries.tint(tints);
  }

  /** The area to outline and label (tapped, open, or where the person stands), or null. */
  focusArea(id: string | null): void {
    this.#boundaries.focus(id);
  }

  setMode(mode: MapMode): void {
    this.#mode = mode;
    this.#renderLayers();
  }

  /** One point: fly there (to `zoom`, else at least street level), clear of the sheet or card. Several: fit them all, between the search and a card. */
  moveTo(points: readonly LonLat[], zoom?: number): void {
    const [first] = points;
    if (!first) return;
    if (points.length === 1) {
      const to = zoom ?? Math.max(this.#map.getZoom(), this.#settings.siteZoom);
      this.#map.flyTo({ center: [...first], zoom: to, offset: this.#clearOffset() });
      return;
    }
    const bounds = points.reduce((box, point) => box.extend([...point]), new LngLatBounds([...first], [...first]));
    this.#map.fitBounds(bounds, { padding: FitPadding.of(this.#map.getContainer(), this.#settings), maxZoom: this.#settings.siteZoom });
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

  /** Places the person's dot; moving there is a camera request ("Go to my location"), never automatic. */
  showUser(position: LonLat): void {
    this.#userMarker ??= new Marker({ element: SiteMap.#userDot() });
    this.#userMarker.setLngLat([...position]).addTo(this.#map);
  }

  destroy(): void {
    this.#map.remove();
  }

  #listen({ onPick, onPickStack, onPickArea, onViewChange }: SiteMapOptions): void {
    // A zero-size container gives an empty box; the resize that follows fires moveend with the real one.
    const emitView = (byUser = false) => {
      if (this.#map.getContainer().clientHeight > 0) onViewChange({ ...this.#view(), byUser });
    };
    this.#map.on('load', () => {
      this.#collapseAttribution();
      this.#addSiteLayers()
        .then(() => emitView())
        .catch((error: unknown) => console.error('Could not add site layers', error));
    });
    // MapLibre sets originalEvent only on moves the person made; flyTo and fitBounds have none.
    this.#map.on('moveend', (event) => emitView(event.originalEvent !== undefined));
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
    return { bbox: new BBox(bounds.getWest(), bounds.getSouth(), bounds.getEast(), bounds.getNorth()) };
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
