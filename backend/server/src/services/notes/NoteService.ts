import type { SiteNote } from "../../contracts/index.gen.js";
import { NotFoundError } from "../../domain/errors.js";
import type { Requester } from "../../domain/letters/types.js";
import type { NoteLanguage, StoredNote } from "../../domain/notes/Community.js";
import type { Logger } from "../../ports/Logger.js";
import type { SiteReader } from "../../ports/letters/SiteReader.js";
import type { NoteModerator } from "../../ports/moderation/NoteModerator.js";
import type { NoteStore, Scheduler } from "../../ports/notes/NoteStore.js";
import type { LetterRateLimiter } from "../letters/LetterRateLimiter.js";
import type { CommunityRefresher } from "./CommunityRefresher.js";

export interface NoteRequest {
  readonly siteId: string;
  readonly text: string;
  readonly language: NoteLanguage;
  readonly requester: Requester;
  // A one-way hash of the signed-in user id; the id itself is never stored with a note.
  readonly authorHash: string;
}

export interface NoteServiceParts {
  readonly sites: SiteReader;
  readonly limiter: LetterRateLimiter;
  readonly moderator: NoteModerator;
  readonly notes: NoteStore;
  readonly refresher: CommunityRefresher;
  readonly scheduler: Scheduler;
  readonly stamp: { now(): Date; noteId(): string };
  readonly logger: Logger;
}

export class NoteService {
  readonly #parts: NoteServiceParts;

  constructor(parts: NoteServiceParts) {
    this.#parts = parts;
  }

  async add(request: NoteRequest): Promise<SiteNote> {
    const { sites, limiter, moderator, notes, stamp } = this.#parts;
    if ((await sites.find(request.siteId)) === null) {
      throw new NotFoundError(`No site ${request.siteId}`);
    }
    const now = stamp.now();
    await limiter.take(request.requester, now);
    const moderation = await moderator.review(request.text);
    const shown = moderation.result === "clean";
    const note: StoredNote = {
      noteId: stamp.noteId(),
      siteId: request.siteId,
      authorHash: request.authorHash,
      text: shown ? request.text : null,
      language: request.language,
      moderation,
      createdAt: now.toISOString().replace(/\.\d{3}Z$/, "Z"),
    };
    await notes.add(note);
    if (shown) {
      this.#refreshLater(request.siteId);
    }
    const { noteId, siteId, text, language, createdAt } = note;
    return { note_id: noteId, site_id: siteId, status: shown ? "shown" : "hidden", text, language, moderation, created_at: createdAt };
  }

  // The answer does not wait for the analysis; a failure is logged, never thrown at the resident.
  #refreshLater(siteId: string): void {
    this.#parts.scheduler.after(0, async () => {
      try {
        await this.#parts.refresher.noteAccepted(siteId);
      } catch (error) {
        this.#parts.logger.error({ error, site_id: siteId }, "community refresh failed");
      }
    });
  }
}
