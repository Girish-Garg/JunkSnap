import type { ShownNote } from "../../domain/notes/Community.js";
import type { Logger } from "../../ports/Logger.js";
import type { SiteReader } from "../../ports/letters/SiteReader.js";
import type { CommunityWriter, NoteStore, ReportNoteReader, Scheduler } from "../../ports/notes/NoteStore.js";
import type { NoteAnalyzer } from "./NoteAnalyzer.js";

// At most one analysis per site in this window; a note inside it schedules one run at its end.
export const REFRESH_WINDOW_MS = 10 * 60 * 1000;

export interface RefresherParts {
  readonly notes: NoteStore;
  readonly reportNotes: ReportNoteReader;
  readonly sites: SiteReader;
  readonly analyzer: NoteAnalyzer;
  readonly writer: CommunityWriter;
  readonly scheduler: Scheduler;
  readonly now: () => Date;
  readonly logger: Logger;
}

export class CommunityRefresher {
  readonly #parts: RefresherParts;
  readonly #scheduled = new Set<string>();

  constructor(parts: RefresherParts) {
    this.#parts = parts;
  }

  // Called when a note is accepted: analyze now, or once when the site's window ends.
  async noteAccepted(siteId: string): Promise<void> {
    if (this.#scheduled.has(siteId)) {
      return;
    }
    const wait = await this.#waitMs(siteId);
    if (wait <= 0) {
      await this.refresh(siteId);
      return;
    }
    this.#scheduled.add(siteId);
    this.#parts.scheduler.after(wait, async () => {
      this.#scheduled.delete(siteId);
      await this.refresh(siteId);
    });
  }

  async refresh(siteId: string): Promise<void> {
    const { notes, reportNotes, analyzer, writer, now } = this.#parts;
    const shown = [...(await notes.shownFor(siteId)), ...(await reportNotes.shownFor(siteId))];
    if (shown.length === 0) {
      return;
    }
    const people = CommunityRefresher.#people(shown);
    const reading = await analyzer.analyze(shown, people);
    if (reading === null) {
      return;
    }
    const updatedAt = now().toISOString().replace(/\.\d{3}Z$/, "Z");
    await writer.save(siteId, { notes_count: shown.length, people, ...reading, updated_at: updatedAt });
  }

  async #waitMs(siteId: string): Promise<number> {
    const site = await this.#parts.sites.find(siteId);
    const last = site?.properties.community?.updated_at;
    return last === undefined ? 0 : Date.parse(last) + REFRESH_WINDOW_MS - this.#parts.now().getTime();
  }

  // One person's several notes count once.
  static #people(notes: readonly ShownNote[]): number {
    return new Set(notes.map((note) => note.authorHash)).size;
  }
}
