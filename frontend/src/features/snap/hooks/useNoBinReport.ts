import { useState } from 'react';
import { useServices } from '../../../app/useServices';
import { CAPTURE_GATES } from '../../../domain/CaptureGates';
import type { GpsFix } from '../../../domain/ReportUpload';
import { useActionErrors } from '../../actions/hooks/useActionErrors';
import { useSessionGate } from '../../actions/hooks/useSessionGate';

export type NoBinState = 'idle' | 'sending' | 'sent' | 'signIn' | 'failed';

const NO_CODES: ReadonlySet<string> = new Set();

/** One tap sends "no dustbin within 1 km of here" from the current fix (decision 20261010-1630); onSent gets the report id. */
export function useNoBinReport(fix: GpsFix | null, onSent: (reportId: string) => void) {
  const { snap } = useServices();
  const handle = useActionErrors('nobin', NO_CODES);
  const [state, setState] = useState<NoBinState>('idle');
  const send = async (at: GpsFix, reauthed = false) => {
    setState('sending');
    try {
      const accepted = await snap.noBin.report(at);
      setState('sent');
      onSent(accepted.report_id);
    } catch (error) {
      // A session the api ended opens sign-in and sends once more after; anything else asks to check the connection.
      setState(handle(error, reauthed ? null : () => void send(at, true)) === 'sign_in' ? 'signIn' : 'failed');
    }
  };
  const sendable = useSessionGate(CAPTURE_GATES.noBin, { fix, sent: state === 'sent', busy: state === 'sending' });
  const problem = state === 'signIn' || state === 'failed' ? `nobin.${state}` : null;
  return { state, problem, sendable, send: () => fix && void send(fix) };
}
