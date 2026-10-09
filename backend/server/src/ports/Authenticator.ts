// userId is the token's `sub`; email and other claims are never kept.
export interface AuthUser {
  readonly userId: string;
}

// Rejects with UnauthorizedError for a bad token, ExternalServiceError when the keys cannot be fetched.
export interface Authenticator {
  verify(token: string): Promise<AuthUser>;
}
