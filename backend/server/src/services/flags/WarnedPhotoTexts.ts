import type { FlagText } from "../../domain/flags/PhotoFlag.js";
import { PHOTO_FLAG_WARN, PhotoFlagPolicy } from "../../domain/flags/PhotoFlagPolicy.js";
import type { ShownNote } from "../../domain/notes/Community.js";
import type { PhotoFlagStore } from "../../ports/flags/PhotoFlagStore.js";
import type { ReportNoteReader } from "../../ports/notes/NoteStore.js";

// Decision 20261011-0310-hem-photo-flags: a description feeds the community analysis, as a neutral photo report,
// only once several people reported that photo; one person's word about a photo is never a signal.
export class WarnedPhotoTexts implements ReportNoteReader {
  readonly #store: Pick<PhotoFlagStore, "textsFor">;
  readonly #policy = new PhotoFlagPolicy();

  constructor(store: Pick<PhotoFlagStore, "textsFor">) {
    this.#store = store;
  }

  async shownFor(siteId: string): Promise<ShownNote[]> {
    const rows = await this.#store.textsFor(siteId);
    const warned = this.#warnedPhotos(rows);
    return rows.flatMap((row) =>
      row.text !== null && warned.has(row.photoId) ? [{ text: row.text, authorHash: row.author.authorHash, source: "photo_report" as const }] : [],
    );
  }

  #warnedPhotos(rows: readonly FlagText[]): Set<string> {
    const photos = new Set(rows.map((row) => row.photoId));
    const authorsOf = (photoId: string) => rows.filter((row) => row.photoId === photoId).map((row) => row.author);
    return new Set([...photos].filter((photoId) => this.#policy.people(authorsOf(photoId)) >= PHOTO_FLAG_WARN));
  }
}
