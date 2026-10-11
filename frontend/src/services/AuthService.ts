export interface AuthUser {
  readonly email: string;
}

/** Account port: MockAuthService in mock mode; AmplifyAuthService (Cognito) in live mode. */
export interface AuthService {
  /** False when live mode has no Cognito pool configured; the sign-in sheet says so. */
  available(): boolean;
  /** Reads a saved session once at start. */
  restore(): Promise<void>;
  /** True while restore() reads the saved session, so currentUser() may still turn from null to the account. */
  restoring(): boolean;
  currentUser(): AuthUser | null;
  /** Returns an unsubscribe function. */
  subscribe(listener: () => void): () => void;
  signIn(email: string, password: string): Promise<AuthUser>;
  /** Sends a 6-digit code to the email. */
  signUp(email: string, password: string): Promise<void>;
  /** Signs in when this visit made the account; null means sign in next. */
  confirmSignUp(email: string, code: string): Promise<AuthUser | null>;
  resendCode(email: string): Promise<void>;
  forgotPassword(email: string): Promise<void>;
  resetPassword(email: string, code: string, newPassword: string): Promise<void>;
  signOut(): Promise<void>;
  /** A fresh Cognito ID token for Authorization: Bearer, or null for a guest. */
  idToken(forceRefresh?: boolean): Promise<string | null>;
  /** The fixed code a mock sends, shown as a hint; null for a real provider. */
  sampleCode(): string | null;
}
