import { useState } from 'react';
import { useServices } from '../../../app/useServices';
import { PHOTO_FLAG_TEXT_MAX, type PhotoFlagReason } from '../../../domain/PhotoFlag';
import { useAuthFlow } from '../../auth/hooks/useAuthFlow';
import { useMapContext } from '../../map/useMapContext';
import { ActionProblem } from '../ActionProblem';

const KNOWN_ERRORS: ReadonlySet<string> = new Set(['own_photo', 'rate_limited', 'not_found']);

export interface PhotoReportPlace {
  readonly siteId: string;
  readonly photoId: string;
}

/** The reason and optional description for one photo; once sent, the sheet closes, a toast thanks, and the site reloads. */
export function usePhotoReportForm(place: PhotoReportPlace, onSent: () => void) {
  const { snap } = useServices();
  const { requireAuth } = useAuthFlow();
  const { announce } = useMapContext();
  const [reason, setReason] = useState<PhotoFlagReason | null>(null);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const send = async (chosen: PhotoFlagReason) => {
    setBusy(true);
    setProblem(null);
    try {
      await snap.siteActions.flagPhoto(place.siteId, place.photoId, chosen, text);
      announce('photoReport.done');
      onSent();
    } catch (error) {
      setProblem(ActionProblem.of(error, KNOWN_ERRORS));
      setBusy(false);
    }
  };
  const submit = () => {
    if (reason !== null && !busy) requireAuth(() => void send(reason));
  };
  return { reason, setReason, text, setText, busy, problem, ready: reason !== null && !busy, left: PHOTO_FLAG_TEXT_MAX - text.length, submit };
}
