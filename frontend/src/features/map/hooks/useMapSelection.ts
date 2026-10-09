import { useCallback, useState } from 'react';
import { useMatch, useNavigate } from 'react-router';
import { SITE_PATH, sitePath } from '../../../app/paths';
import type { Place } from '../../../domain/PlaceSearch';
import type { SiteFeature } from '../../../domain/Site';
import type { CameraRequest } from '../CameraRequest';

/** Which site is previewed or open, and where the camera should go. */
export function useMapSelection(loaded: readonly SiteFeature[]) {
  const navigate = useNavigate();
  const openId = useMatch(SITE_PATH)?.params.siteId ?? null;
  const [preview, setPreview] = useState<SiteFeature | null>(null);
  const [camera, setCamera] = useState<CameraRequest | null>(null);
  const pick = useCallback(
    (siteId: string | null) => setPreview(loaded.find((site) => site.properties.site_id === siteId) ?? null),
    [loaded],
  );
  const showSite = useCallback((site: SiteFeature) => setCamera({ points: [site.geometry.coordinates] }), []);
  const openDetails = useCallback(
    (site: SiteFeature) => {
      setPreview(null);
      showSite(site);
      navigate(sitePath(site.properties.site_id));
    },
    [navigate, showSite],
  );
  const showPlace = useCallback((place: Place) => {
    setPreview(place.sites.length === 1 ? (place.sites[0] ?? null) : null);
    setCamera({ points: place.sites.map((site) => site.geometry.coordinates) });
  }, []);
  const selectedId = openId ?? preview?.properties.site_id ?? null;
  return { openId, selectedId, preview, camera, pick, showSite, openDetails, showPlace };
}
