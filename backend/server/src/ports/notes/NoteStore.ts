import type { Community, ShownNote, StoredNote } from "../../domain/notes/Community.js";

export interface NoteStore {
  add(note: StoredNote): Promise<void>;
  // Shown notes on the site, newest first.
  shownFor(siteId: string): Promise<ShownNote[]>;
}

// Moderated notes that came with the site's reports (report_upload.note).
export interface ReportNoteReader {
  shownFor(siteId: string): Promise<ShownNote[]>;
}

export interface CommunityWriter {
  save(siteId: string, community: Community): Promise<void>;
}

// Runs a task later, for the per-site debounce.
export interface Scheduler {
  after(ms: number, task: () => Promise<void>): void;
}
