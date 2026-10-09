import type { NoteVerdict } from "../../domain/moderation/types.js";
import type { NoteModerator } from "../../ports/moderation/NoteModerator.js";

// Stand-in until the LLM layer lands: every note is kept, and the stamp shows that nothing checked it.
export class PassThroughNoteModerator implements NoteModerator {
  async review(): Promise<NoteVerdict> {
    return { result: "clean", reasons: [], provider: "junksnap", model: "pass-through", version: "0" };
  }
}
