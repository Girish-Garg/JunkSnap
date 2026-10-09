import type { LayerSpecification, Map as MapLibreMap } from 'maplibre-gl';
import { REPORT_TYPES } from '../domain/ReportType';
import type { LayerContext, MapLayer } from './MapLayer';
import SitesLayer from './SitesLayer';

/** The selected site as a larger pin with an accent ring, shown at every zoom and in every mode. */
export default class SelectedSiteLayer implements MapLayer {
  readonly id = 'site-selected';
  readonly order = 30;
  readonly interactive = true;

  async prepare(map: MapLibreMap): Promise<void> {
    await Promise.all(REPORT_TYPES.map((type) => SitesLayer.addPin(map, type, true)));
  }

  spec({ sourceId, selectedId }: LayerContext): LayerSpecification {
    return {
      id: this.id,
      type: 'symbol',
      source: sourceId,
      filter: ['==', ['get', 'site_id'], selectedId ?? ''],
      layout: {
        'icon-image': ['concat', 'pin-selected-', ['get', 'report_type']],
        'icon-allow-overlap': true,
        'icon-ignore-placement': true,
      },
    };
  }
}
