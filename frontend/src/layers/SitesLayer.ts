import type { ExpressionSpecification, LayerSpecification, Map as MapLibreMap } from 'maplibre-gl';
import type { MapMode } from '../domain/MapMode';
import { REPORT_TYPES, type ReportType } from '../domain/ReportType';
import { MarkerArt } from '../ui/MarkerArt';
import type { LayerContext, MapLayer } from './MapLayer';

// Image size; the visible disc is about 26 px (selected about 39 px with its ring).
const PIN_PX = 32;
const PIXEL_RATIO = 2;
// Pins fade in as HeatLayer fades out; full from MapLibre zoom 12, the city view.
const AUTO_MIN_ZOOM = 11;
const AUTO_OPACITY: ExpressionSpecification = ['interpolate', ['linear'], ['zoom'], 11, 0, 12, 1];
const UNVERIFIED: ExpressionSpecification = ['==', ['get', 'verification'], 'unverified'];
// Stacks (several sites at one spot) are drawn by StackPinsLayer from the same source.
const LONE: ExpressionSpecification = ['!', ['has', 'stack_count']];

/** How pins show in a map mode; StackPinsLayer fades the same way. */
export interface PinFade {
  readonly minzoom: number;
  readonly opacity: ExpressionSpecification | number;
  readonly visibility: 'none' | 'visible';
}

export default class SitesLayer implements MapLayer {
  readonly id = 'site-pins';
  readonly order = 20;
  readonly interactive = true;

  async prepare(map: MapLibreMap): Promise<void> {
    const pins = REPORT_TYPES.flatMap((type) => [SitesLayer.addPin(map, type, false), SitesLayer.addPin(map, type, false, true)]);
    await Promise.all(pins);
  }

  // Unverified sites are hollow, dashed pins with an "n/10" badge (decision 20261010-1530).
  spec({ pinSourceId, mode, selectedId }: LayerContext): LayerSpecification {
    const fade = SitesLayer.fade(mode);
    return {
      id: this.id,
      type: 'symbol',
      source: pinSourceId,
      minzoom: fade.minzoom,
      // The selected site is drawn by SelectedSiteLayer instead.
      filter: ['all', LONE, ['!=', ['get', 'site_id'], selectedId ?? '']],
      layout: {
        visibility: fade.visibility,
        'icon-image': ['concat', 'pin-', ['case', UNVERIFIED, 'unverified-', ''], ['get', 'report_type']],
        'icon-allow-overlap': true,
        'text-field': ['get', 'backers_badge'],
        'text-font': ['Noto Sans Bold'],
        'text-size': 12,
        'text-offset': [0, 1.5],
        // Pins that would overlap are stacked; a badge that still touches another drops out, never smears.
        'text-allow-overlap': false,
        'text-optional': true,
      },
      paint: {
        'icon-opacity': fade.opacity,
        'text-opacity': fade.opacity,
        'text-color': '#221c15',
        'text-halo-color': '#ffc23d',
        'text-halo-width': 3,
      },
    };
  }

  static fade(mode: MapMode): PinFade {
    const auto = mode === 'auto';
    return { minzoom: auto ? AUTO_MIN_ZOOM : 0, opacity: auto ? AUTO_OPACITY : 1, visibility: mode === 'heat' ? 'none' : 'visible' };
  }

  /** Adds one pin image; shared with SelectedSiteLayer so both look alike. */
  static async addPin(map: MapLibreMap, type: ReportType, selected: boolean, hollow = false): Promise<void> {
    const name = `${selected ? 'pin-selected-' : 'pin-'}${hollow ? 'unverified-' : ''}${type}`;
    const size = (selected ? 40 : PIN_PX) * PIXEL_RATIO;
    await SitesLayer.addImage(map, name, MarkerArt.dataUrl(type, size, selected, hollow), size);
  }

  /** Decodes an SVG data URL into a map image of `size` device pixels, once per name. */
  static async addImage(map: MapLibreMap, name: string, url: string, size: number): Promise<void> {
    if (map.hasImage(name)) return;
    const image = new Image(size, size);
    image.src = url;
    await image.decode();
    if (!map.hasImage(name)) map.addImage(name, image, { pixelRatio: PIXEL_RATIO });
  }
}
