import { Marker, type Map as MapLibreMap } from 'maplibre-gl';
import type { LonLat } from '../../domain/Site';

/**
 * A DOM ring under the selected pin: it drops in with a bounce, then pulses gently (map.css). The pin itself
 * stays a map symbol so picking and drawing order do not change. CSS handles reduced motion.
 */
export class SelectedPulse {
  readonly #map: MapLibreMap;
  #marker: Marker | null = null;
  #key = '';

  constructor(map: MapLibreMap) {
    this.#map = map;
  }

  show(position: LonLat | null): void {
    const key = position ? position.join(',') : '';
    if (key === this.#key) return;
    this.#key = key;
    this.#marker?.remove();
    this.#marker = null;
    if (!position) return;
    this.#marker = new Marker({ element: SelectedPulse.#element(), anchor: 'center' }).setLngLat([...position]).addTo(this.#map);
  }

  static #element(): HTMLElement {
    const ring = document.createElement('span');
    ring.className = 'pin-pulse';
    ring.setAttribute('aria-hidden', 'true');
    return ring;
  }
}
