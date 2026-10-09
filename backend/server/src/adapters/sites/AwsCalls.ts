import { ExternalServiceError, JunkSnapError } from "../../domain/errors.js";

const CONDITION_FAILED = "ConditionalCheckFailedException";

// Translates SDK failures into domain errors; our own errors pass through unchanged.
export class AwsCalls {
  async run<T>(action: string, call: () => Promise<T>): Promise<T> {
    try {
      return await call();
    } catch (error) {
      throw AwsCalls.#translated(action, error);
    }
  }

  // False when DynamoDB refused the write because its condition failed.
  async conditional(action: string, call: () => Promise<unknown>): Promise<boolean> {
    try {
      await call();
      return true;
    } catch (error) {
      if (error instanceof Error && error.name === CONDITION_FAILED) {
        return false;
      }
      throw AwsCalls.#translated(action, error);
    }
  }

  static #translated(action: string, error: unknown): Error {
    return error instanceof JunkSnapError ? error : new ExternalServiceError(`${action} failed`, { cause: error });
  }
}
