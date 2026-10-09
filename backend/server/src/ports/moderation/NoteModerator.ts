import type { NoteVerdict } from "../../domain/moderation/types.js";

export interface NoteModerator {
  // A removed note is never shown; the report itself still goes on.
  review(note: string): Promise<NoteVerdict>;
}
