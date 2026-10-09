import type { Feature, FeatureCollection, Point as GeoPoint } from 'geojson';
import { Map as MapLibreMap, Marker, type GeoJSONSource, type MapGeoJSONFeature, type Point } from 'maplibre-gl';
import { BBox } from '../../domain/BBox';
import type { LonLat, SiteFeature } from '../../domain/Site';
import type { LayerRegistry } from '../../layers/LayerRegistry';

// OpenFreeMap needs no key; MapCredit shows the OpenStreetMap credit.
const STYLE_URL = 'https://tiles.openfreemap.org/styles/liberty';
const JODHPUR: [number, number] = [73.02, 26.27];
const INDIA_BOUNDS: [[number, number], [number, number]] = [[60, 4], [100, 38.5]];
const SOURCE_ID = 'sites';
const TAP_TOLERANCE_PX = 14;
// GET /sites allows 1 by 1 degree; stay under it after rounding.
const MAX_QUERY_SPAN_DEG = 0.99;
// Must match the desktop .sheet rules in ui/theme.css.
const DESKTOP_QUERY = '(min-width: 768px)';
const SIDE_PANEL_PX = 408;

export interface MapView {
  readonly bbox: BBox;
  /** The view is wider than one API query, so only its centre is loaded. */
  readonly clamped: boolean;
}

export interface SiteMapOptions {
  readonly container: HTMLElement;
  readonly layers: LayerRegistry;
  readonly onSelect: (siteId: string) => void;
  readonly onViewChange: (view: MapView) => void;
}

export class SiteMap {
  readonly #map: MapLibreMap;
  readonly #layers: LayerRegistry;
  #sites: readonly SiteFeature[] = [];
  #selectedId: string | null = null;
  #revealedId: string | null = null;
  #userMarker: Marker | null = null;

  constructor(options: SiteMapOptions) {
    this.#layers = options.layers;
    this.#map = new MapLibreMap({
      container: options.container,
      style: STYLE_URL,
      center: JODHPUR,
      zoom: 12,
      minZoom: 4,
      maxBounds: INDIA_BOUNDS,
      attributionControl: false,
    });
    this.#listen(options);
  }

  showSites(sites: readonly SiteFeature[]): void {
    this.#sites = sites;
    this.#source()?.setData(this.#collection());
    // A deep link selects before the sites arrive.
    if (this.#selectedId !== this.#revealedId) this.#reveal(this.#selectedId);
  }

  select(siteId: string | null): void {
    this.#setSelected(this.#selectedId, false);
    this.#selectedId = siteId;
    this.#setSelected(siteId, true);
    this.#reveal(siteId);
  }

  showUser(position: LonLat): void {
    this.#userMarker ??= new Marker({ element: SiteMap.#userDot() });
    this.#userMarker.setLngLat([...position]).addTo(this.#map);
    this.#map.flyTo({ center: [...position], zoom: Math.max(this.#map.getZoom(), 15) });
  }

  destroy(): void {
    this.#map.remove();
  }

  #listen({ onSelect, onViewChange }: SiteMapOptions): void {
    this.#map.on('load', () => {
      this.#addSiteLayers()
        .then(() => onViewChange(this.#view()))
        .catch((error: unknown) => console.error('Could not add site layers', error));
    });
    this.#map.on('moveend', () => onViewChange(this.#view()));
    this.#map.on('click', (event) => this.#pick(event.point, onSelect));
    for (const id of this.#layers.interactiveIds()) {
      this.#map.on('mouseenter', id, () => this.#setCursor('pointer'));
      this.#map.on('mouseleave', id, () => this.#setCursor(''));
    }
  }

  async #addSiteLayers(): Promise<void> {
    const layers = this.#layers.all();
    await Promise.all(layers.map((layer) => layer.prepare?.(this.#map)));
    this.#map.addSource(SOURCE_ID, {
      type: 'geojson',
      data: this.#collection(),
      promoteId: 'site_id',
      cluster: true,
      clusterMaxZoom: 11,
      clusterRadius: 48,
    });
    for (const layer of layers) this.#map.addLayer(layer.spec(SOURCE_ID));
    this.#setSelected(this.#selectedId, true);
  }

  #pick(point: Point, onSelect: (siteId: string) => void): void {
    const box: [[number, number], [number, number]] = [
      [point.x - TAP_TOLERANCE_PX, point.y - TAP_TOLERANCE_PX],
      [point.x + TAP_TOLERANCE_PX, point.y + TAP_TOLERANCE_PX],
    ];
    const [hit] = this.#map.queryRenderedFeatures(box, { layers: this.#layers.interactiveIds() });
    if (!hit) return;
    const siteId: unknown = hit.properties['site_id'];
    if (typeof siteId === 'string') onSelect(siteId);
    else void this.#openCluster(hit);
  }

  async #openCluster(cluster: MapGeoJSONFeature): Promise<void> {
    const clusterId: unknown = cluster.properties['cluster_id'];
    const source = this.#source();
    if (typeof clusterId !== 'number' || !source) return;
    const zoom = await source.getClusterExpansionZoom(clusterId);
    const [lon = 0, lat = 0] = (cluster.geometry as GeoPoint).coordinates;
    this.#map.easeTo({ center: [lon, lat], zoom });
  }

  #reveal(siteId: string | null): void {
    const site = this.#sites.find((candidate) => candidate.properties.site_id === siteId);
    if (!site) return;
    this.#revealedId = site.properties.site_id;
    const { clientHeight } = this.#map.getContainer();
    // Keep the site clear of the panel: right of it on desktop, above the half sheet on phones.
    const offset: [number, number] = window.matchMedia(DESKTOP_QUERY).matches
      ? [SIDE_PANEL_PX / 2, 0]
      : [0, -Math.round(clientHeight * 0.2)];
    this.#map.easeTo({ center: [...site.geometry.coordinates], offset, duration: 400 });
  }

  #setSelected(siteId: string | null, selected: boolean): void {
    if (siteId === null || !this.#source()) return;
    this.#map.setFeatureState({ source: SOURCE_ID, id: siteId }, { selected });
  }

  #source(): GeoJSONSource | undefined {
    return this.#map.getSource<GeoJSONSource>(SOURCE_ID);
  }

  #collection(): FeatureCollection {
    // MapLibre types want mutable GeoJSON but it only reads it.
    const features = this.#sites as unknown as Feature[];
    return { type: 'FeatureCollection', features };
  }

  #view(): MapView {
    const bounds = this.#map.getBounds();
    const view = new BBox(bounds.getWest(), bounds.getSouth(), bounds.getEast(), bounds.getNorth());
    return { bbox: view.clampedTo(MAX_QUERY_SPAN_DEG), clamped: view.isWiderThan(MAX_QUERY_SPAN_DEG) };
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
