export interface AuthUser {
  readonly email: string;
}

/** Account port. MockAuthService now; a Cognito adapter replaces it in a later task. */
export interface AuthService {
  currentUser(): AuthUser | null;
  /** Returns an unsubscribe function. */
  subscribe(listener: () => void): () => void;
  signIn(email: string, password: string): Promise<AuthUser>;
  /** Sends a 6-digit code to the email. */
  signUp(email: string, password: string): Promise<void>;
  confirmSignUp(email: string, code: string): Promise<AuthUser>;
  resendCode(email: string): Promise<void>;
  forgotPassword(email: string): Promise<void>;
  resetPassword(email: string, code: string, newPassword: string): Promise<void>;
  signOut(): Promise<void>;
  /** The fixed code a mock sends, shown as a hint; null for a real provider. */
  sampleCode(): string | null;
}
