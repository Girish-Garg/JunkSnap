import { useState } from 'react';
import { useServices } from '../../../app/useServices';
import { ActionProblem } from '../../site/ActionProblem';
import { usePhotoCapture, type CapturedPhoto } from '../../snap/hooks/usePhotoCapture';

export type CleanupPhase = 'camera' | 'review' | 'sent';

// 409s with their own message; anything else says the photo did not go through.
const KNOWN_ERRORS: ReadonlySet<string> = new Set(['cleanup_pending', 'already_cleaned', 'rate_limited', 'not_found']);

const problemOf = (error: unknown) => ActionProblem.of(error, KNOWN_ERRORS);

/** After-photo from the in-app camera (place and time frozen at the shutter), then the cleanup claim. */
export function useCleanup(siteId: string) {
  const { snap } = useServices();
  const [phase, setPhase] = useState<CleanupPhase>('camera');
  const [photo, setPhoto] = useState<CapturedPhoto | null>(null);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const capture = usePhotoCapture((taken) => {
    setPhoto(taken);
    setPhase('review');
  });
  const send = async () => {
    if (!photo) return;
    setBusy(true);
    setProblem(null);
    try {
      await snap.siteActions.cleanup(siteId, { bytes: photo.bytes, sha256: photo.sha256, gps: photo.gps, capturedAt: photo.capturedAt });
      setPhase('sent');
    } catch (error) {
      setProblem(problemOf(error));
    } finally {
      setBusy(false);
    }
  };
  return { phase, photo, busy, problem, capture, send: () => void send(), retake: () => setPhase('camera') };
}

export type CleanupFlow = ReturnType<typeof useCleanup>;
