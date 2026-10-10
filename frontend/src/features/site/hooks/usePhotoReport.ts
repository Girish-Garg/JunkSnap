import { useCallback, useState } from 'react';
import type { GatedAction } from '../../actions/GatedAction';

export interface PhotoReportTarget {
  /** The photo being reported, or null while no report sheet is open. */
  readonly photoId: string | null;
  /** Through the site's reportPhoto gate: says why not, takes a fresh fix or signs in first, then opens the sheet. */
  readonly start: (photoId: string) => void;
  readonly close: () => void;
}

/** Which photo of the site the resident is reporting (decision 20261011-0310-hem-photo-flags). */
export function usePhotoReport(gated: GatedAction): PhotoReportTarget {
  const [photoId, setPhotoId] = useState<string | null>(null);
  const start = useCallback((id: string) => gated.tap(() => setPhotoId(id))(), [gated]);
  const close = useCallback(() => setPhotoId(null), []);
  return { photoId, start, close };
}
