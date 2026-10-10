import { useState } from 'react';
import { CAPTURE_GATES } from '../../../domain/CaptureGates';
import type { LatLon } from '../../../domain/ReportUpload';
import { gatedBy, type GatedAction } from '../../actions/GatedAction';
import { useGate } from '../../actions/hooks/useGate';
import type { CapturedPhoto } from './usePhotoCapture';
import type { ReportChoice, SnapFlow } from './useSnapFlow';

interface ReviewChoice {
  readonly choice: ReportChoice | null;
  readonly gpsTooVague: boolean;
}

/** Send on the review: saves the photo with its choice and target; off, with the reason, until both are picked. */
export function useReviewSend(photo: CapturedPhoto, flow: SnapFlow, report: ReviewChoice, target: LatLon | null): { readonly sendable: GatedAction; readonly send: () => void } {
  const gate = useGate();
  const [sending, setSending] = useState(false);
  const send = () => {
    if (!report.choice) return;
    setSending(true);
    void flow.send(photo, target ? { ...report.choice, target } : report.choice).finally(() => setSending(false));
  };
  const vagueM = report.gpsTooVague ? photo.gps.accuracy_m : null;
  const sendable = gatedBy(gate, CAPTURE_GATES.send.decide({ busy: sending, chosen: report.choice !== null, vagueM }));
  return { sendable, send };
}
