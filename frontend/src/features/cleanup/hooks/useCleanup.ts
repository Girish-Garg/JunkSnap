import { useState } from 'react';
import { useServices } from '../../../app/useServices';
import { CLEANUP_SEND_GATE } from '../../../domain/SiteActionGates';
import { useActionErrors } from '../../actions/hooks/useActionErrors';
import { useSessionGate } from '../../actions/hooks/useSessionGate';
import { usePhotoCapture, type CapturedPhoto } from '../../snap/hooks/usePhotoCapture';

export type CleanupPhase = 'camera' | 'review' | 'sent';

// 409s with their own message; anything else says the photo did not go through.
const KNOWN_ERRORS: ReadonlySet<string> = new Set(['cleanup_pending', 'already_cleaned', 'rate_limited', 'not_found']);

/** After-photo from the in-app camera (place and time frozen at the shutter), then the cleanup claim. */
export function useCleanup(siteId: string) {
  const { snap } = useServices();
  const handle = useActionErrors('cleanup', KNOWN_ERRORS);
  const [phase, setPhase] = useState<CleanupPhase>('camera');
  const [photo, setPhoto] = useState<CapturedPhoto | null>(null);
  const [cleanupId, setCleanupId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const capture = usePhotoCapture((taken) => {
    setPhoto(taken);
    setPhase('review');
  });
  const send = async (reauthed = false) => {
    if (!photo) return;
    setBusy(true);
    setProblem(null);
    try {
      const accepted = await snap.siteActions.cleanup(siteId, { bytes: photo.bytes, sha256: photo.sha256, gps: photo.gps, capturedAt: photo.capturedAt });
      setCleanupId(accepted.cleanup_id);
      setPhase('sent');
    } catch (error) {
      setProblem(handle(error, reauthed ? null : () => void send(true)));
    } finally {
      setBusy(false);
    }
  };
  const sendable = useSessionGate(CLEANUP_SEND_GATE, { busy });
  return { phase, photo, cleanupId, busy, problem, capture, sendable, send: () => void send(), retake: () => setPhase('camera') };
}

export type CleanupFlow = ReturnType<typeof useCleanup>;
