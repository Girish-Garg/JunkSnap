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
  // Shown photo report descriptions: read only alongside notes, as neutral signals.
  readonly photoReports: ReportNoteReader;
  readonly sites: SiteReader;
  readonly analyzer: NoteAnalyzer;
  readonly writer: CommunityWriter;
  readonly scheduler: Scheduler;
  readonly now: () => Date;
  readonly logger: Logger;
}

export class CommunityRefresher {
  readonly #parts: RefresherParts;
  // Sites with a run scheduled or in flight; set before the first await, so two notes never start two runs.
  readonly #busy = new Set<string>();
  // Sites whose run is reading notes now; a note that lands then may be missed, so it queues one more run.
  readonly #running = new Set<string>();
  // Sites that got a note while their run was in flight: exactly one more run follows, after the window.
  readonly #again = new Set<string>();
  // Epoch ms of the last run per site, kept even when it saved nothing, so failures are debounced too.
  readonly #lastAttempt = new Map<string, number>();

  constructor(parts: RefresherParts) {
    this.#parts = parts;
  }

  // Called when a note is accepted: analyze now, or once when the site's window ends.
  async noteAccepted(siteId: string): Promise<void> {
    if (this.#busy.has(siteId)) {
      // A scheduled run has not read the notes yet, so it will include this one.
      if (this.#running.has(siteId)) {
        this.#again.add(siteId);
      }
      return;
    }
    this.#busy.add(siteId);
    await this.#cycle(siteId);
  }

  async #cycle(siteId: string): Promise<void> {
    let wait: number;
    try {
      wait = await this.#waitMs(siteId);
    } catch (error) {
      this.#parts.logger.error({ error, site_id: siteId }, "community refresh could not read the site");
      this.#busy.delete(siteId);
      return;
    }
    if (wait > 0) {
      this.#parts.scheduler.after(wait, () => this.#run(siteId));
      return;
    }
    await this.#run(siteId);
  }

  // Never rejects: a failure is logged and the site is released, or kept busy for the queued run.
  async #run(siteId: string): Promise<void> {
    this.#lastAttempt.set(siteId, this.#parts.now().getTime());
    this.#running.add(siteId);
    try {
      await this.refresh(siteId);
    } catch (error) {
      this.#parts.logger.error({ error, site_id: siteId }, "community refresh failed");
    } finally {
      this.#running.delete(siteId);
      if (this.#again.delete(siteId)) {
        void this.#cycle(siteId);
      } else {
        this.#busy.delete(siteId);
      }
    }
  }

  async refresh(siteId: string): Promise<void> {
    const { notes, reportNotes, photoReports, analyzer, writer, now } = this.#parts;
    const shown = [...(await notes.shownFor(siteId)), ...(await reportNotes.shownFor(siteId))];
    if (shown.length === 0) {
      return;
    }
    const people = CommunityRefresher.#people(shown);
    const reading = await analyzer.analyze(shown, people, await photoReports.shownFor(siteId));
    if (reading === null) {
      return;
    }
    const updatedAt = now().toISOString().replace(/\.\d{3}Z$/, "Z");
    await writer.save(siteId, { notes_count: shown.length, people, ...reading, updated_at: updatedAt });
  }

  async #waitMs(siteId: string): Promise<number> {
    const site = await this.#parts.sites.find(siteId);
    const saved = site?.properties.community?.updated_at;
    const last = Math.max(saved === undefined ? 0 : Date.parse(saved), this.#lastAttempt.get(siteId) ?? 0);
    return last === 0 ? 0 : last + REFRESH_WINDOW_MS - this.#parts.now().getTime();
  }

  // One person's several notes count once.
  static #people(notes: readonly ShownNote[]): number {
    return new Set(notes.map((note) => note.authorHash)).size;
  }
}
