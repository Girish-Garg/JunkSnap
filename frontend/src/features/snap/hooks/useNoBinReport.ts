import { useState } from 'react';
import { useServices } from '../../../app/useServices';
import { AuthError } from '../../../domain/AuthError';
import type { GpsFix } from '../../../domain/ReportUpload';

export type NoBinState = 'idle' | 'sending' | 'sent' | 'signIn' | 'failed';

/** One tap sends "no dustbin within 1 km of here" from the current fix (decision 20261010-1630). */
export function useNoBinReport() {
  const { snap } = useServices();
  const [state, setState] = useState<NoBinState>('idle');
  const send = async (fix: GpsFix) => {
    setState('sending');
    try {
      await snap.noBin.report(fix);
      setState('sent');
    } catch (error) {
      setState(error instanceof AuthError ? 'signIn' : 'failed');
    }
  };
  const busy = state === 'sending' || state === 'sent';
  const problem = state === 'signIn' || state === 'failed' ? `nobin.${state}` : null;
  return { state, send, busy, problem };
}
