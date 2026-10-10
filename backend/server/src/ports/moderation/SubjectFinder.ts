import type { FoundSubjects } from "../../domain/moderation/Subject.js";

export interface SubjectFinder {
  find(jpeg: Uint8Array): Promise<FoundSubjects>;
}
