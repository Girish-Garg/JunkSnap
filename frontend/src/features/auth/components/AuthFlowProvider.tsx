import type { ReactNode } from 'react';
import { useServices } from '../../../app/useServices';
import '../../../ui/form.css';
import { AuthFlowContext } from '../AuthFlowContext';
import { useAuthFlowState } from '../hooks/useAuthFlowState';
import { AuthSheet } from './AuthSheet';

export function AuthFlowProvider({ children }: { readonly children: ReactNode }) {
  const { auth } = useServices();
  const flow = useAuthFlowState(auth);
  return (
    <AuthFlowContext.Provider value={flow}>
      {children}
      <AuthSheet />
    </AuthFlowContext.Provider>
  );
}
