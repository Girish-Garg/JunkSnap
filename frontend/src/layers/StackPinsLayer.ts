import type { LayerSpecification, Map as MapLibreMap } from 'maplibre-gl';
import { REPORT_TYPES } from '../domain/ReportType';
import { MarkerArt } from '../ui/MarkerArt';
import type { LayerContext, MapLayer } from './MapLayer';
import SitesLayer from './SitesLayer';

// The stack image is 40 px; its sun sticker is centred 11 px right of and above the middle (MarkerArt.stackSvg).
const STACK_PX = 40;
const PIXEL_RATIO = 2;
const COUNT_SIZE = 11;
const BADGE_OFFSET_EM = 11 / COUNT_SIZE;

/**
 * Several sites at one spot as one pin: the lead type's disc with a second disc behind it and the number of
 * sites on a sun sticker. Hollow when every site in it is still unverified. A tap lists every site there.
 */
export default class StackPinsLayer implements MapLayer {
  readonly id = 'site-stacks';
  readonly order = 25;
  readonly interactive = true;

  async prepare(map: MapLibreMap): Promise<void> {
    const size = STACK_PX * PIXEL_RATIO;
    const images = REPORT_TYPES.flatMap((type) => [
      SitesLayer.addImage(map, `pin-stack-${type}`, MarkerArt.stackDataUrl(type, size), size),
      SitesLayer.addImage(map, `pin-stack-unverified-${type}`, MarkerArt.stackDataUrl(type, size, true), size),
    ]);
    await Promise.all(images);
  }

  spec({ pinSourceId, mode }: LayerContext): LayerSpecification {
    const fade = SitesLayer.fade(mode);
    return {
      id: this.id,
      type: 'symbol',
      source: pinSourceId,
      minzoom: fade.minzoom,
      filter: ['has', 'stack_count'],
      layout: {
        visibility: fade.visibility,
        'icon-image': ['get', 'stack_icon'],
        'icon-allow-overlap': true,
        'text-field': ['to-string', ['get', 'stack_count']],
        'text-font': ['Noto Sans Bold'],
        'text-size': COUNT_SIZE,
        'text-offset': [BADGE_OFFSET_EM, -BADGE_OFFSET_EM],
        // The count is the point of the pin: it always shows.
        'text-allow-overlap': true,
        'text-ignore-placement': true,
      },
      paint: {
        'icon-opacity': fade.opacity,
        'text-opacity': fade.opacity,
        // MapLibre cannot read CSS variables: the --ink value on the --sun sticker.
        'text-color': '#221c15',
      },
    };
  }
}
