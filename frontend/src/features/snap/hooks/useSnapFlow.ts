import { useState } from 'react';
import { useServices } from '../../../app/useServices';
import type { ReportDraft } from '../../../domain/ReportUpload';
import { useCaptureMode } from './useCaptureMode';
import { usePhotoCapture, type CapturedPhoto } from './usePhotoCapture';

export type SnapPhase =
  | { readonly kind: 'camera' }
  | { readonly kind: 'review'; readonly photo: CapturedPhoto }
  | { readonly kind: 'sent'; readonly id: string }
  | { readonly kind: 'scanSent'; readonly id: string; readonly cameraStopped?: boolean }
  | { readonly kind: 'noBinSent'; readonly id: string };

export type { CaptureMode } from './useCaptureMode';

/** me_too_site_id is set only by "Add a photo" on a site (SitePhotoPreset). */
export type ReportChoice = Pick<ReportDraft, 'report_type' | 'context' | 'note' | 'target' | 'me_too_site_id'>;

const CAMERA: SnapPhase = { kind: 'camera' };

/** Camera (photo or video), then review, then the saved item's progress; retake keeps the asked-for type, "again" starts fresh. */
export function useSnapFlow() {
  const { snap } = useServices();
  const [phase, setPhase] = useState<SnapPhase>(CAMERA);
  const modes = useCaptureMode();
  const [saveFailed, setSaveFailed] = useState(false);
  const capture = usePhotoCapture((photo) => setPhase({ kind: 'review', photo }));
  const send = async (photo: CapturedPhoto, choice: ReportChoice) => {
    setSaveFailed(false);
    try {
      const draft: ReportDraft = { ...choice, gps: photo.gps, sha256: photo.sha256, captured_at: photo.capturedAt };
      const report = await snap.queue.add(draft, photo.bytes);
      setPhase({ kind: 'sent', id: report.id });
    } catch {
      setSaveFailed(true);
    }
  };
  const scanSaved = (id: string, cameraStopped = false) => setPhase({ kind: 'scanSent', id, cameraStopped });
  const noBinSent = (id: string) => setPhase({ kind: 'noBinSent', id });
  const restart = () => {
    modes.clearPreset();
    setPhase(CAMERA);
  };
  // A retaken photo is a new attempt: the last one's "Could not save" no longer applies.
  const retake = () => {
    setSaveFailed(false);
    setPhase(CAMERA);
  };
  return { phase, ...modes, capture, saveFailed, send, scanSaved, noBinSent, retake, restart };
}

export type SnapFlow = ReturnType<typeof useSnapFlow>;
