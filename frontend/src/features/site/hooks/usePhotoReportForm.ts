import { useState } from 'react';
import { useServices } from '../../../app/useServices';
import { PHOTO_FLAG_TEXT_MAX, type PhotoFlagReason } from '../../../domain/PhotoFlag';
import { useActionErrors } from '../../actions/hooks/useActionErrors';
import { useAuthFlow } from '../../auth/hooks/useAuthFlow';
import { useMapContext } from '../../map/useMapContext';

const KNOWN_ERRORS: ReadonlySet<string> = new Set(['own_photo', 'too_far', 'rate_limited', 'not_found', 'location']);

export interface PhotoReportPlace {
  readonly siteId: string;
  readonly photoId: string;
}

/** The reason and optional description for one photo; once sent, the sheet closes, a toast thanks, and the site reloads. */
export function usePhotoReportForm(place: PhotoReportPlace, onSent: () => void) {
  const { snap } = useServices();
  const { requireAuth } = useAuthFlow();
  const handle = useActionErrors('reportPhoto', KNOWN_ERRORS);
  const { announce } = useMapContext();
  const [reason, setReason] = useState<PhotoFlagReason | null>(null);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const send = async (chosen: PhotoFlagReason, reauthed = false) => {
    setBusy(true);
    setProblem(null);
    try {
      await snap.siteActions.flagPhoto(place.siteId, place.photoId, chosen, text);
      announce('photoReport.done');
      onSent();
    } catch (error) {
      setProblem(handle(error, reauthed ? null : () => void send(chosen, true)));
      setBusy(false);
    }
  };
  const submit = () => {
    if (reason !== null && !busy) requireAuth(() => void send(reason));
  };
  return { reason, setReason, text, setText, busy, problem, ready: reason !== null && !busy, left: PHOTO_FLAG_TEXT_MAX - text.length, submit };
}
