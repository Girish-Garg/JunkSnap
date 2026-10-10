import { ulid } from "ulid";
import type { Logger } from "../../ports/Logger.js";
import type { SiteReader } from "../../ports/letters/SiteReader.js";
import type { NoteModerator } from "../../ports/moderation/NoteModerator.js";
import type { CommunityWriter, NoteStore, ReportNoteReader, Scheduler } from "../../ports/notes/NoteStore.js";
import { LetterRateLimiter, type LetterCounters } from "../../services/letters/LetterRateLimiter.js";
import { WordingCheck } from "../../services/letters/WordingCheck.js";
import { CommunityRefresher } from "../../services/notes/CommunityRefresher.js";
import { NoteAnalyzer, type AnalysisRouter } from "../../services/notes/NoteAnalyzer.js";
import { NoteService } from "../../services/notes/NoteService.js";

export interface NotesAdapters {
  readonly sites: SiteReader;
  readonly notes: NoteStore;
  readonly reportNotes: ReportNoteReader;
  readonly writer: CommunityWriter;
  readonly counters: LetterCounters;
  readonly moderator: NoteModerator;
  readonly router: AnalysisRouter;
  readonly scheduler: Scheduler;
  readonly now: () => Date;
}

// setTimeout for the debounce; a task that rejects is logged, never left as an unhandled rejection.
export class TimerScheduler implements Scheduler {
  readonly #logger: Logger;

  constructor(logger: Logger) {
    this.#logger = logger;
  }

  after(ms: number, task: () => Promise<void>): void {
    setTimeout(() => {
      task().catch((error: unknown) => this.#logger.error({ error }, "scheduled task failed"));
    }, ms).unref();
  }
}

export class NotesAssembly {
  readonly #notesPerHour: number;
  readonly #logger: Logger;

  constructor(notesPerHour: number, logger: Logger) {
    this.#notesPerHour = notesPerHour;
    this.#logger = logger;
  }

  service(adapters: NotesAdapters): NoteService {
    const logger = this.#logger;
    const analyzer = new NoteAnalyzer(adapters.router, new WordingCheck(), logger);
    const refresher = new CommunityRefresher({ ...adapters, analyzer, logger });
    return new NoteService({
      sites: adapters.sites,
      limiter: new LetterRateLimiter(adapters.counters, this.#notesPerHour, "notes"),
      moderator: adapters.moderator,
      notes: adapters.notes,
      refresher,
      scheduler: adapters.scheduler,
      stamp: { now: adapters.now, noteId: () => `note_${ulid().toLowerCase()}` },
      logger,
    });
  }
}
