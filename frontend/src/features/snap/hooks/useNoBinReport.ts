import { useState } from 'react';
import { useServices } from '../../../app/useServices';
import type { GpsFix } from '../../../domain/ReportUpload';
import { useActionErrors } from '../../actions/hooks/useActionErrors';

export type NoBinState = 'idle' | 'sending' | 'sent' | 'signIn' | 'failed';

const NO_CODES: ReadonlySet<string> = new Set();

/** One tap sends "no dustbin within 1 km of here" from the current fix (decision 20261010-1630). */
export function useNoBinReport() {
  const { snap } = useServices();
  const handle = useActionErrors('nobin', NO_CODES);
  const [state, setState] = useState<NoBinState>('idle');
  const send = async (fix: GpsFix) => {
    setState('sending');
    try {
      await snap.noBin.report(fix);
      setState('sent');
    } catch (error) {
      // A session the api ended opens sign-in and sends again after; anything else asks to check the connection.
      setState(handle(error, () => void send(fix)) === 'sign_in' ? 'signIn' : 'failed');
    }
  };
  const problem = state === 'signIn' || state === 'failed' ? `nobin.${state}` : null;
  return { state, send, problem };
}
