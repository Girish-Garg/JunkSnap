import type { FlagAuthor, PhotoFlagState } from "./PhotoFlag.js";

// Decision 20261011-0310-hem-photo-flags: nothing happens on one person's word.
export const PHOTO_FLAG_WARN = 3;
export const PHOTO_FLAG_HIDE = 8;
// Fewer reports hide a photo early only when they outnumber the people backing it by this surplus.
export const PHOTO_FLAG_HIDE_EARLY = 5;
export const PHOTO_FLAG_SURPLUS = 5;
// Photo reports an hour, per user and per device.
export const FLAGS_PER_HOUR = 10;
// Like votes: only someone within this distance of the site may report its photos.
export const FLAG_RADIUS_M = 1000;

// Turns a photo's reports into its warned and hidden state; hidden is final.
export class PhotoFlagPolicy {
  // Rows are one per user; two accounts on one device still count once.
  people(authors: readonly FlagAuthor[]): number {
    const users = new Set(authors.map((author) => author.authorHash)).size;
    const devices = new Set(authors.map((author) => author.deviceHash)).size;
    return Math.min(users, devices);
  }

  // backers: people backing the site other than the photo's own reporter.
  state(people: number, backers: number, wasHidden: boolean): PhotoFlagState {
    const early = people >= PHOTO_FLAG_HIDE_EARLY && people - backers >= PHOTO_FLAG_SURPLUS;
    const hidden = wasHidden || people >= PHOTO_FLAG_HIDE || early;
    return { count: people, warned: hidden || people >= PHOTO_FLAG_WARN, hidden };
  }

  // A site goes only when its reporters outnumber every backer, the photo's reporter included, by the surplus.
  removesSite(reporters: number, backers: number): boolean {
    return reporters - backers >= PHOTO_FLAG_SURPLUS;
  }
}
