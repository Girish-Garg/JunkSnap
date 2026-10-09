import { useContext } from 'react';
import { JunkSnapError } from '../../../domain/JunkSnapError';
import { AuthFlowContext, type AuthFlow } from '../AuthFlowContext';

export function useAuthFlow(): AuthFlow {
  const flow = useContext(AuthFlowContext);
  if (!flow) throw new JunkSnapError('useAuthFlow must be used inside <AuthFlowProvider>');
  return flow;
}
