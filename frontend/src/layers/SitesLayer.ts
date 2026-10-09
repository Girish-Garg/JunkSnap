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

export default class SitesLayer implements MapLayer {
  readonly id = 'site-pins';
  readonly order = 20;
  readonly interactive = true;

  async prepare(map: MapLibreMap): Promise<void> {
    await Promise.all(REPORT_TYPES.map((type) => SitesLayer.addPin(map, type, false)));
  }

  spec({ sourceId, mode, selectedId }: LayerContext): LayerSpecification {
    return {
      id: this.id,
      type: 'symbol',
      source: sourceId,
      minzoom: mode === 'auto' ? AUTO_MIN_ZOOM : 0,
      // The selected site is drawn by SelectedSiteLayer instead.
      filter: ['!=', ['get', 'site_id'], selectedId ?? ''],
      layout: {
        visibility: mode === 'heat' ? 'none' : 'visible',
        'icon-image': ['concat', 'pin-', ['get', 'report_type']],
        'icon-allow-overlap': true,
      },
      paint: { 'icon-opacity': mode === 'auto' ? AUTO_OPACITY : 1 },
    };
  }

  /** Adds one pin image; shared with SelectedSiteLayer so both look alike. */
  static async addPin(map: MapLibreMap, type: ReportType, selected: boolean): Promise<void> {
    const name = `${selected ? 'pin-selected-' : 'pin-'}${type}`;
    if (map.hasImage(name)) return;
    const size = (selected ? 40 : PIN_PX) * PIXEL_RATIO;
    const image = new Image(size, size);
    image.src = MarkerArt.dataUrl(type, size, selected);
    await image.decode();
    if (!map.hasImage(name)) map.addImage(name, image, { pixelRatio: PIXEL_RATIO });
  }
}
