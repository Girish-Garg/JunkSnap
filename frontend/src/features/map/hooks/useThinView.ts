import { useMemo, useState } from 'react';
import type { SiteFeature } from '../../../domain/Site';
import { ThinView, type ThinState } from '../../../domain/ThinView';
import type { CameraRequest } from '../CameraRequest';
import type { MapView } from '../SiteMap';

interface ThinSources {
  readonly view: MapView | null;
  /** The view finished loading, empty or not. */
  readonly settled: boolean;
  readonly sites: readonly SiteFeature[];
  /** The nearest sites just off an empty view, or null while that search is on its way. */
  readonly nearest: readonly SiteFeature[] | null;
  /** The pilot city's sites, if they were already loaded. */
  readonly pilot: readonly SiteFeature[] | null;
  /** The last camera move the app asked for (the opening fit, Zoom out, a search). */
  readonly camera: CameraRequest | null;
}

// A camera move is on its way until the map reports its next view, so the opening fit never flashes the card.
function useMoving(camera: CameraRequest | null, view: MapView | null): boolean {
  const [asked, setAsked] = useState({ camera, view });
  if (asked.camera !== camera) setAsked({ camera, view });
  const current = asked.camera === camera ? asked : { camera, view };
  return camera !== null && current.view === view;
}

/** Whether the view holds few or no sites, from what the page already loaded: it never asks the api itself. */
export function useThinView({ view, settled, sites, nearest, pilot, camera }: ThinSources): ThinState | null {
  const moving = useMoving(camera, view);
  return useMemo(() => {
    const known = nearest === null ? null : [...nearest, ...(pilot ?? [])];
    return ThinView.of({ view: view?.bbox ?? null, settled: settled && !moving, sites, known });
  }, [view, settled, moving, sites, nearest, pilot]);
}
