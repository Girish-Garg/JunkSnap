import { createContext } from 'react';

export type AuthStep = 'signIn' | 'signUp' | 'verify' | 'forgot';

export interface AuthFlow {
  readonly step: AuthStep | null;
  /** Carried between steps so nobody types it twice. */
  readonly email: string;
  readonly notice: string | null;
  go(step: AuthStep, email?: string, notice?: string): void;
  close(): void;
  /** Runs the action now if signed in; otherwise after sign-in succeeds. notice: the sheet's opening line, e.g. "Sign in to vote". */
  requireAuth(action: () => void, notice?: string): void;
  /** The api ended the session (401 after a refresh): sign in again, then run the action. What the person typed stays. */
  reauth(action: () => void, notice: string): void;
  /** Call after a successful sign-in: closes the sheet and resumes the action. */
  finish(): void;
}

export const AuthFlowContext = createContext<AuthFlow | null>(null);
