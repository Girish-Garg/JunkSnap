import { useState } from 'react';
import { CAPTURE_GATES } from '../../../domain/CaptureGates';
import { gatedBy, type GatedAction } from '../../actions/GatedAction';
import { useGate } from '../../actions/hooks/useGate';
import type { CapturedPhoto } from './usePhotoCapture';
import type { ReportChoice, SnapFlow } from './useSnapFlow';

interface ReviewChoice {
  /** What is sent, target included; null until it can be. */
  readonly choice: ReportChoice | null;
  readonly vagueM: number | null;
  readonly tooFarLimitM?: number | null;
}

/** Send on a review: saves the photo with its choice; off, with the reason, until the choice can be sent. */
export function useReviewSend(photo: CapturedPhoto, flow: SnapFlow, report: ReviewChoice): { readonly sendable: GatedAction; readonly send: () => void } {
  const gate = useGate();
  const [sending, setSending] = useState(false);
  const send = () => {
    if (!report.choice) return;
    setSending(true);
    void flow.send(photo, report.choice).finally(() => setSending(false));
  };
  const facts = { busy: sending, chosen: report.choice !== null, vagueM: report.vagueM, tooFarLimitM: report.tooFarLimitM };
  const sendable = gatedBy(gate, CAPTURE_GATES.send.decide(facts));
  return { sendable, send };
}
