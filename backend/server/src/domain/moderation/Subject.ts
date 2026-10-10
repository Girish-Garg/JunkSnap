import type { Box } from "./Box.js";

// two_wheeler also covers bicycles and three-wheelers: their plates sit higher in the box than a car's.
export type SubjectKind = "person" | "vehicle" | "two_wheeler";

// A person or vehicle that may show a face or a number plate; confidence is in percent.
export interface Subject {
  readonly kind: SubjectKind;
  readonly box: Box;
  readonly confidence: number;
}

// What DetectLabels found: License Plate boxes, plus the people and vehicles in the photo.
export interface FoundSubjects {
  readonly plates: readonly Box[];
  readonly subjects: readonly Subject[];
  readonly model: string;
  readonly version: string | null;
}
