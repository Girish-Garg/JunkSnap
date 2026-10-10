import type { ExpressionSpecification, LayerSpecification, Map as MapLibreMap } from 'maplibre-gl';
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

export default class SitesLayer implements MapLayer {
  readonly id = 'site-pins';
  readonly order = 20;
  readonly interactive = true;

  async prepare(map: MapLibreMap): Promise<void> {
    const pins = REPORT_TYPES.flatMap((type) => [SitesLayer.addPin(map, type, false), SitesLayer.addPin(map, type, false, true)]);
    await Promise.all(pins);
  }

  // Unverified sites are hollow, dashed pins with an "n/10" badge (decision 20261010-1530).
  spec({ sourceId, mode, selectedId }: LayerContext): LayerSpecification {
    const opacity = mode === 'auto' ? AUTO_OPACITY : 1;
    return {
      id: this.id,
      type: 'symbol',
      source: sourceId,
      minzoom: mode === 'auto' ? AUTO_MIN_ZOOM : 0,
      // The selected site is drawn by SelectedSiteLayer instead.
      filter: ['!=', ['get', 'site_id'], selectedId ?? ''],
      layout: {
        visibility: mode === 'heat' ? 'none' : 'visible',
        'icon-image': ['concat', 'pin-', ['case', UNVERIFIED, 'unverified-', ''], ['get', 'report_type']],
        'icon-allow-overlap': true,
        'text-field': ['get', 'backers_badge'],
        'text-font': ['Noto Sans Regular'],
        'text-size': 11,
        'text-offset': [0, 1.5],
        'text-allow-overlap': true,
        'text-optional': true,
      },
      paint: {
        'icon-opacity': opacity,
        'text-opacity': opacity,
        'text-color': '#3c4043',
        'text-halo-color': '#ffffff',
        'text-halo-width': 1.5,
      },
    };
  }

  /** Adds one pin image; shared with SelectedSiteLayer so both look alike. */
  static async addPin(map: MapLibreMap, type: ReportType, selected: boolean, hollow = false): Promise<void> {
    const name = `${selected ? 'pin-selected-' : 'pin-'}${hollow ? 'unverified-' : ''}${type}`;
    if (map.hasImage(name)) return;
    const size = (selected ? 40 : PIN_PX) * PIXEL_RATIO;
    const image = new Image(size, size);
    image.src = MarkerArt.dataUrl(type, size, selected, hollow);
    await image.decode();
    if (!map.hasImage(name)) map.addImage(name, image, { pixelRatio: PIXEL_RATIO });
  }
}
