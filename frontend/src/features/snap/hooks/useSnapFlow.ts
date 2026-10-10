import { useState } from 'react';
import { useServices } from '../../../app/useServices';
import type { ReportDraft } from '../../../domain/ReportUpload';
import { useCaptureMode } from './useCaptureMode';
import { usePhotoCapture, type CapturedPhoto } from './usePhotoCapture';

export type SnapPhase =
  | { readonly kind: 'camera' }
  | { readonly kind: 'review'; readonly photo: CapturedPhoto }
  | { readonly kind: 'sent'; readonly id: string }
  | { readonly kind: 'scanSent'; readonly id: string; readonly cameraStopped?: boolean };

export type { CaptureMode } from './useCaptureMode';

export type ReportChoice = Pick<ReportDraft, 'report_type' | 'context' | 'note' | 'target'>;

const CAMERA: SnapPhase = { kind: 'camera' };

/** Camera (photo or video), then review, then the saved item's progress; retake keeps the asked-for type, "again" starts fresh. */
export function useSnapFlow() {
  const { snap } = useServices();
  const [phase, setPhase] = useState<SnapPhase>(CAMERA);
  const { mode, setMode, presetType, photoFor, clearPreset } = useCaptureMode();
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
  const restart = () => {
    clearPreset();
    setPhase(CAMERA);
  };
  return { phase, mode, setMode, presetType, photoFor, capture, saveFailed, send, scanSaved, retake: () => setPhase(CAMERA), restart };
}

export type SnapFlow = ReturnType<typeof useSnapFlow>;
