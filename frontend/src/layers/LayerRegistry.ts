import { MAP_DEFAULTS } from '../config/MapSettings';
import { SITE_RULE_DEFAULTS } from '../config/SiteRules';
import type { LayerSettings, MapLayer } from './MapLayer';

type LayerClass = new (settings: LayerSettings) => MapLayer;

const DEFAULT_SETTINGS: LayerSettings = { zoneRadiusM: SITE_RULE_DEFAULTS.zoneRadiusM, latitude: MAP_DEFAULTS.pilotCentre[1] };

// Adding a layer = adding a *Layer.ts file that default-exports its class.
const layerModules = import.meta.glob<LayerClass>(['./*Layer.ts', '!./MapLayer.ts'], {
  eager: true,
  import: 'default',
});

export class LayerRegistry {
  readonly #layers: readonly MapLayer[];

  constructor(classes: readonly LayerClass[] = Object.values(layerModules), settings: LayerSettings = DEFAULT_SETTINGS) {
    this.#layers = classes.map((LayerType) => new LayerType(settings)).sort((a, b) => a.order - b.order);
  }

  all(): readonly MapLayer[] {
    return this.#layers;
  }

  interactiveIds(): string[] {
    return this.#layers.filter((layer) => layer.interactive).map((layer) => layer.id);
  }
}
