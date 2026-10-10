import { useCallback, useState } from 'react';
import { useAuthFlow } from '../../auth/hooks/useAuthFlow';

export interface PhotoReportTarget {
  /** The photo being reported, or null while no report sheet is open. */
  readonly photoId: string | null;
  /** Signs in first if needed, then opens the report sheet for this photo. */
  readonly start: (photoId: string) => void;
  readonly close: () => void;
}

/** Which photo of the site the resident is reporting (decision 20261011-0310-hem-photo-flags). */
export function usePhotoReport(): PhotoReportTarget {
  const { requireAuth } = useAuthFlow();
  const [photoId, setPhotoId] = useState<string | null>(null);
  const start = useCallback((id: string) => requireAuth(() => setPhotoId(id)), [requireAuth]);
  const close = useCallback(() => setPhotoId(null), []);
  return { photoId, start, close };
}
