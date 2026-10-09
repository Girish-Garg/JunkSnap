// null when the secret does not exist; any other failure throws ExternalServiceError.
export interface SecretReader {
  read(secretId: string): Promise<string | null>;
}
