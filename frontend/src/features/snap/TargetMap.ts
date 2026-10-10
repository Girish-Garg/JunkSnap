import { AttributionControl, Map as MapLibreMap, Marker, type GeoJSONSource, type MapMouseEvent } from 'maplibre-gl';
import type { Feature, LineString } from 'geojson';
import type { LatLon } from '../../domain/ReportUpload';

// The same keyless basemap as the main map (SiteMap).
const STYLE_URL = 'https://tiles.openfreemap.org/styles/positron';
// About 400 m across a phone-width map, so a 300 m reach fits after a small zoom-out.
const START_ZOOM = 16;
const MAX_ZOOM = 18;
const LINE_ID = 'target-line';
const HEADING_ID = 'heading-line';

export interface TargetMapOptions {
  readonly container: HTMLElement;
  readonly origin: LatLon;
  /** Text in the UI language: the attribution toggle, the reporter's dot, the waste pin and the gesture hints. */
  readonly labels: TargetMapLabels;
  /** The pin was dropped after a drag, or the map was tapped; the point is raw, before any cap. */
  readonly onMove: (point: LatLon) => void;
}

export interface TargetMapLabels {
  readonly attribution: string;
  readonly you: string;
  readonly pin: string;
  /** Shown when one finger drags the map (the sheet scrolls instead), and for a plain wheel on desktop. */
  readonly twoFingers: string;
  readonly ctrlScroll: string;
  readonly cmdScroll: string;
}

interface Drawn {
  readonly spot: LatLon;
  readonly headingEnd: LatLon | null;
}

/**
 * A small map centred on the reporter's fix: a dot for the reporter, a draggable pin for the waste, a line
 * between them and, when the phone has a compass, a dashed line the way it faces. Colours come from the tokens.
 */
export class TargetMap {
  readonly #map: MapLibreMap;
  readonly #pin: Marker;
  readonly #origin: LatLon;
  #drawn: Drawn;

  constructor(options: TargetMapOptions) {
    const { container, origin, labels, onMove } = options;
    const center: [number, number] = [origin.lon, origin.lat];
    this.#origin = origin;
    this.#drawn = { spot: origin, headingEnd: null };
    this.#map = new MapLibreMap({
      container,
      style: STYLE_URL,
      center,
      zoom: START_ZOOM,
      maxZoom: MAX_ZOOM,
      // The map sits in a scrolling sheet: one finger scrolls the sheet, two move the map. Pin drags and taps still work.
      cooperativeGestures: true,
      attributionControl: false,
      locale: TargetMap.#locale(labels),
    });
    this.#map.addControl(new AttributionControl({ compact: true }), 'bottom-left');
    new Marker({ element: TargetMap.#element('target-map__you', labels.you) }).setLngLat(center).addTo(this.#map);
    this.#pin = new Marker({ element: TargetMap.#element('target-map__pin', labels.pin), draggable: true, anchor: 'bottom' });
    this.#pin.setLngLat(center).addTo(this.#map);
    this.#listen(onMove);
  }

  /** Moves the pin to the placement's spot and redraws both lines. */
  show(spot: LatLon, headingEnd: LatLon | null): void {
    this.#drawn = { spot, headingEnd };
    this.#pin.setLngLat([spot.lon, spot.lat]);
    this.#draw();
  }

  destroy(): void {
    this.#map.remove();
  }

  #listen(onMove: (point: LatLon) => void): void {
    this.#pin.on('dragend', () => {
      const { lng, lat } = this.#pin.getLngLat();
      onMove({ lat, lon: lng });
    });
    this.#map.on('click', (event: MapMouseEvent) => onMove({ lat: event.lngLat.lat, lon: event.lngLat.lng }));
    this.#map.on('load', () => this.#addLines());
  }

  #addLines(): void {
    const tokens = getComputedStyle(this.#map.getContainer());
    const color = (name: string) => tokens.getPropertyValue(name).trim();
    for (const id of [LINE_ID, HEADING_ID]) this.#map.addSource(id, { type: 'geojson', data: TargetMap.#line([]) });
    this.#map.addLayer({ id: LINE_ID, type: 'line', source: LINE_ID, paint: TargetMap.#paint(color('--accent')) });
    this.#map.addLayer({ id: HEADING_ID, type: 'line', source: HEADING_ID, paint: TargetMap.#paint(color('--ink'), [1, 2]) });
    this.#draw();
  }

  #draw(): void {
    const { spot, headingEnd } = this.#drawn;
    const line = this.#map.getSource<GeoJSONSource>(LINE_ID);
    const heading = this.#map.getSource<GeoJSONSource>(HEADING_ID);
    line?.setData(TargetMap.#line([this.#origin, spot]));
    heading?.setData(TargetMap.#line(headingEnd ? [this.#origin, headingEnd] : []));
  }

  // A token that did not resolve (no stylesheet) leaves MapLibre's default colour.
  static #paint(color: string, dash?: number[]) {
    const dashed = dash ? { 'line-dasharray': dash } : {};
    return { 'line-width': 3, 'line-opacity': 0.85, ...dashed, ...(color ? { 'line-color': color } : {}) };
  }

  static #line(points: readonly LatLon[]): Feature<LineString> {
    return { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: points.map((p) => [p.lon, p.lat]) } };
  }

  static #locale(labels: TargetMapLabels): Record<string, string> {
    return {
      'AttributionControl.ToggleAttribution': labels.attribution,
      'CooperativeGesturesHandler.MobileHelpText': labels.twoFingers,
      'CooperativeGesturesHandler.WindowsHelpText': labels.ctrlScroll,
      'CooperativeGesturesHandler.MacHelpText': labels.cmdScroll,
    };
  }

  static #element(className: string, label: string): HTMLElement {
    const element = document.createElement('span');
    element.className = className;
    element.setAttribute('aria-label', label);
    element.setAttribute('role', 'img');
    return element;
  }
}
