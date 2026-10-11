import { useMemo } from 'react';
import { useLocation, useMatch } from 'react-router';
import { AREA_PATH } from '../../../app/paths';
import type { MapMode } from '../../../domain/MapMode';
import type { LonLat, SiteFeature } from '../../../domain/Site';
import { useAreaPick } from './useAreaPick';
import { useBoundaryLayer } from './useBoundaryLayer';

interface Selection {
  readonly preview: SiteFeature | null;
  readonly stack: readonly SiteFeature[] | null;
  readonly pick: (siteId: string | null) => void;
  readonly pickStack: (siteIds: readonly string[]) => void;
}

const MAP_KINDS: readonly string[] = ['assembly', 'loksabha'];

/** The map area whose page is open, if it is one the map draws. */
function useOpenArea(): string | null {
  const params = useMatch(AREA_PATH)?.params;
  return params?.areaId && MAP_KINDS.includes(params.kind ?? '') ? params.areaId : null;
}

/**
 * What the map draws besides the sites: the view mode, the areas with their tints, fills and markers, the area in
 * focus (tapped, else open, else where the person stands), area taps and stack taps.
 */
export function useMapLayers(mode: MapMode, selection: Selection, position: LonLat | null) {
  const boundary = useBoundaryLayer();
  const area = useAreaPick(selection.preview !== null || selection.stack !== null, () => selection.pick(null));
  const open = useOpenArea();
  const { shapes } = boundary;
  const here = useMemo(() => (position && shapes ? shapes.containing(position) : null), [position, shapes]);
  // The tapped area's card shows on the bare map only; a sheet over it hides it.
  const areaCard = { area: useLocation().pathname === '/' ? area.picked : null, clear: area.clearArea };
  const layerBindings = {
    mode,
    areas: boundary.view,
    areaColors: boundary.colors,
    areaTints: boundary.tints,
    areaMarkers: boundary.markers,
    focusArea: area.picked?.id ?? open ?? here,
    onPickArea: area.onPickArea,
    onPickStack: selection.pickStack,
  };
  return { boundary, areaCard, layerBindings };
}
