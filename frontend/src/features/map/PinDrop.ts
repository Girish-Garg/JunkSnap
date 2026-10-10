import type { Map as MapLibreMap } from 'maplibre-gl';

const DURATION_MS = 700;
const HEIGHT_PX = 22;

// Falls from HEIGHT_PX, lands, then two small bounces (an ease-out bounce curve).
function bounce(t: number): number {
  const n = 7.5625;
  if (t < 1 / 2.75) return n * t * t;
  if (t < 2 / 2.75) return n * (t - 1.5 / 2.75) ** 2 + 0.75;
  if (t < 2.5 / 2.75) return n * (t - 2.25 / 2.75) ** 2 + 0.9375;
  return n * (t - 2.625 / 2.75) ** 2 + 0.984375;
}

/** Drops the pins in with a bounce the first time sites arrive. Skipped under reduced motion. */
export class PinDrop {
  readonly #map: MapLibreMap;
  #done = false;

  constructor(map: MapLibreMap) {
    this.#map = map;
  }

  /** The pin layers (symbol layers) to drop; called whenever sites or layers change, it plays once. */
  play(layerIds: readonly string[], siteCount: number): void {
    const ids = layerIds.filter((id) => this.#map.getLayer(id)?.type === 'symbol');
    if (this.#done || siteCount === 0 || ids.length === 0) return;
    this.#done = true;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    const start = performance.now();
    const step = (now: number) => {
      const t = Math.min((now - start) / DURATION_MS, 1);
      const lift = -HEIGHT_PX * (1 - bounce(t));
      for (const id of ids) {
        if (this.#map.getLayer(id)) this.#map.setPaintProperty(id, 'icon-translate', [0, lift]);
      }
      if (t < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }
}
