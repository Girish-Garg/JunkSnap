import type { ExpressionSpecification, LayerSpecification } from 'maplibre-gl';
import { MAP_DEFAULTS } from '../config/MapSettings';
import { SITE_RULE_DEFAULTS } from '../config/SiteRules';
import type { LayerContext, LayerSettings, MapLayer } from './MapLayer';

// Web Mercator metres per pixel at zoom 0 on the equator; they halve with each zoom step.
const METRES_PER_PX_AT_ZOOM_0 = 156543.03;
const DEFAULTS: LayerSettings = { zoneRadiusM: SITE_RULE_DEFAULTS.zoneRadiusM, latitude: MAP_DEFAULTS.pilotCentre[1] };

/** No-bin zones as a soft circle of the zone radius (1 km) under the pins (decision 20261010-1630); verified ones are a little stronger. */
export default class ZonesLayer implements MapLayer {
  readonly id = 'nobin-zones';
  readonly order = 15;
  readonly interactive = false;
  readonly #radius: ExpressionSpecification;

  // The radius in screen pixels, true near the given latitude (the pilot city's, to the whole degree: 26 N for Jodhpur).
  constructor({ zoneRadiusM, latitude }: LayerSettings = DEFAULTS) {
    const px = zoneRadiusM / (METRES_PER_PX_AT_ZOOM_0 * Math.cos((Math.round(latitude) * Math.PI) / 180));
    this.#radius = ['interpolate', ['exponential', 2], ['zoom'], 0, px, 22, px * 2 ** 22];
  }

  spec({ sourceId, mode }: LayerContext): LayerSpecification {
    const verified: ExpressionSpecification = ['==', ['get', 'verification'], 'verified'];
    return {
      id: this.id,
      type: 'circle',
      source: sourceId,
      filter: ['==', ['get', 'report_type'], 'no_bin'],
      layout: { visibility: mode === 'heat' ? 'none' : 'visible' },
      paint: {
        'circle-radius': this.#radius,
        // MapLibre cannot read CSS variables: the --type-nobin value.
        'circle-color': '#e37400',
        'circle-opacity': ['case', verified, 0.16, 0.08],
        'circle-stroke-color': '#e37400',
        'circle-stroke-width': 1,
        'circle-stroke-opacity': ['case', verified, 0.6, 0.35],
        'circle-pitch-alignment': 'map',
      },
    };
  }
}
