import { ExternalServiceError, JunkSnapError } from "../../domain/errors.js";

// Our own errors pass through; SDK failures become ExternalServiceError.
export async function awsCall<T>(action: string, call: () => Promise<T>): Promise<T> {
  try {
    return await call();
  } catch (error) {
    if (error instanceof JunkSnapError) {
      throw error;
    }
    throw new ExternalServiceError(`${action} failed`, { cause: error });
  }
}

// False when DynamoDB refused the write because its condition failed.
export async function conditionalWrite(action: string, call: () => Promise<unknown>): Promise<boolean> {
  try {
    await call();
    return true;
  } catch (error) {
    if (error instanceof Error && error.name === "ConditionalCheckFailedException") {
      return false;
    }
    throw new ExternalServiceError(`${action} failed`, { cause: error });
  }
}
