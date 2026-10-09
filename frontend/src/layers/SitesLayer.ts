import type { LayerSpecification, Map as MapLibreMap } from 'maplibre-gl';
import { REPORT_TYPES, type ReportType } from '../domain/ReportType';
import { MarkerArt } from '../ui/MarkerArt';
import { SINGLE_SITES, type MapLayer } from './MapLayer';

const ICON_PX = 28;
const PIXEL_RATIO = 2;

export default class SitesLayer implements MapLayer {
  readonly id = 'site-markers';
  readonly order = 30;
  readonly interactive = true;

  async prepare(map: MapLibreMap): Promise<void> {
    await Promise.all(REPORT_TYPES.map((type) => this.#addIcon(map, type)));
  }

  spec(sourceId: string): LayerSpecification {
    return {
      id: this.id,
      type: 'symbol',
      source: sourceId,
      filter: SINGLE_SITES,
      layout: {
        'icon-image': ['concat', 'marker-', ['get', 'report_type']],
        'icon-size': ['interpolate', ['linear'], ['zoom'], 10, 0.75, 14, 1],
        'icon-allow-overlap': true,
        'icon-ignore-placement': true,
      },
    };
  }

  async #addIcon(map: MapLibreMap, type: ReportType): Promise<void> {
    const name = `marker-${type}`;
    if (map.hasImage(name)) return;
    const image = new Image(ICON_PX * PIXEL_RATIO, ICON_PX * PIXEL_RATIO);
    image.src = MarkerArt.dataUrl(type, ICON_PX * PIXEL_RATIO);
    await image.decode();
    if (!map.hasImage(name)) map.addImage(name, image, { pixelRatio: PIXEL_RATIO });
  }
}
