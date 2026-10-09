import { createContext } from 'react';

export type AuthStep = 'signIn' | 'signUp' | 'verify' | 'forgot';

export interface AuthFlow {
  readonly step: AuthStep | null;
  /** Carried between steps so nobody types it twice. */
  readonly email: string;
  readonly notice: string | null;
  go(step: AuthStep, email?: string, notice?: string): void;
  close(): void;
  /** Runs the action now if signed in; otherwise after sign-in succeeds. */
  requireAuth(action: () => void): void;
  /** Call after a successful sign-in: closes the sheet and resumes the action. */
  finish(): void;
}

export const AuthFlowContext = createContext<AuthFlow | null>(null);
