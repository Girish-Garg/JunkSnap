import { Popup, type Map as MapLibreMap, type MapLayerMouseEvent } from 'maplibre-gl';

/** The words behind an area marker's glyph and number, shown on hover (taps open the area page instead). */
export class MarkerTooltip {
  readonly #map: MapLibreMap;
  readonly #popup = new Popup({ closeButton: false, closeOnClick: false, className: 'area-tooltip', offset: 14 });

  constructor(map: MapLibreMap, layerId: string) {
    this.#map = map;
    map.on('mousemove', layerId, (event) => this.#show(event));
    map.on('mouseleave', layerId, () => this.#popup.remove());
  }

  /** The tooltip text a marker feature carries, if any. */
  static text(properties: Readonly<Record<string, unknown>> | undefined): string | null {
    const text = properties?.['marker_tooltip'];
    return typeof text === 'string' && text ? text : null;
  }

  #show(event: MapLayerMouseEvent): void {
    const text = MarkerTooltip.text(event.features?.[0]?.properties);
    if (!text) {
      this.#popup.remove();
      return;
    }
    // setText, never HTML: area names come from data.
    this.#popup.setLngLat(event.lngLat).setText(text).addTo(this.#map);
  }
}
