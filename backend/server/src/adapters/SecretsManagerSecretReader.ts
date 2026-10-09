import { GetSecretValueCommand, type GetSecretValueCommandOutput } from "@aws-sdk/client-secrets-manager";
import { ExternalServiceError } from "../domain/errors.js";
import type { SecretReader } from "../ports/SecretReader.js";

const MISSING = "ResourceNotFoundException";

export interface SecretValueClient {
  send(command: GetSecretValueCommand): Promise<GetSecretValueCommandOutput>;
}

// No cache here: callers keep what they can use, so a secret added later is read on the next call.
export class SecretsManagerSecretReader implements SecretReader {
  readonly #client: SecretValueClient;

  constructor(client: SecretValueClient) {
    this.#client = client;
  }

  async read(secretId: string): Promise<string | null> {
    try {
      const output = await this.#client.send(new GetSecretValueCommand({ SecretId: secretId }));
      return output.SecretString ?? null;
    } catch (error) {
      if (error instanceof Error && error.name === MISSING) {
        return null;
      }
      const name = error instanceof Error ? error.name : "unknown error";
      throw new ExternalServiceError(`secret ${secretId} unreadable: ${name}`, { cause: error });
    }
  }
}
