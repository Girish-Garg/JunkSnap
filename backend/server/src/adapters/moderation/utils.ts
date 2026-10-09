import type { BoundingBox } from "@aws-sdk/client-rekognition";
import { ExternalServiceError } from "../../domain/errors.js";
import { Box } from "../../domain/moderation/Box.js";

// Runs one SDK call and turns any failure into ExternalServiceError.
export async function callService<T>(what: string, call: () => Promise<T>): Promise<T> {
  try {
    return await call();
  } catch (error) {
    throw new ExternalServiceError(`${what} failed`, { cause: error });
  }
}

// Zero or one box, so callers can flatMap over detections with partial geometry.
export function toBoxes(box: BoundingBox | undefined): Box[] {
  const { Left, Top, Width, Height } = box ?? {};
  if (Left === undefined || Top === undefined || Width === undefined || Height === undefined) {
    return [];
  }
  return [new Box(Left, Top, Width, Height)];
}
