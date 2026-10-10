import type { MapMode } from '../../../domain/MapMode';
import type { SiteFeature } from '../../../domain/Site';
import { useAreaPick } from './useAreaPick';
import { useBoundaryLayer } from './useBoundaryLayer';

interface Selection {
  readonly preview: SiteFeature | null;
  readonly pick: (siteId: string | null) => void;
}

/** What the map draws besides the sites: the view mode, the areas with their fill and markers, and area taps. */
export function useMapLayers(mode: MapMode, selection: Selection) {
  const boundary = useBoundaryLayer();
  const onPickArea = useAreaPick(selection.preview, () => selection.pick(null));
  const layerBindings = {
    mode,
    areas: boundary.view,
    areaColors: boundary.colors,
    areaMarkers: boundary.markers,
    onPickArea,
  };
  return { boundary, layerBindings };
}
