import { PhotoFlagPolicy } from "../flags/PhotoFlagPolicy.js";
import type { SiteProperties, SiteState } from "./SiteTypes.js";

// Decision 20261011-0310-hem-photo-flags: an unverified site whose every remaining report is a hidden photo leaves the
// map (photos_reported), but only when the people who reported a photo outnumber all its backers by the surplus.
// Checked after a photo report and after a withdrawal.
export class ReportedPhotoRemoval {
  readonly #state: SiteState;
  readonly #policy = new PhotoFlagPolicy();

  constructor(state: SiteState) {
    this.#state = state;
  }

  apply(at: string): SiteState {
    if (!this.#applies()) {
      return this.#state;
    }
    const { feature } = this.#state;
    const removed = { status: "removed", removed_reason: "photos_reported", removed_at: at } as const;
    return { ...this.#state, feature: { ...feature, properties: { ...feature.properties, ...removed } } };
  }

  // A verified site rests on 10 people, a rejected or removed one is off the map, and withdrawn photos no longer count.
  #applies(): boolean {
    const { properties } = this.#state.feature;
    const { reports } = this.#state.internals;
    const held = new Set(reports.map((report) => report.reportId));
    const hidden = (properties.photo_flags ?? []).filter((entry) => entry.hidden && held.has(entry.photo_id));
    const ids = new Set(hidden.map((entry) => entry.photo_id));
    const allHidden = reports.length > 0 && reports.every((report) => ids.has(report.reportId));
    const reporters = Math.max(0, ...hidden.map((entry) => entry.count));
    return allHidden && ReportedPhotoRemoval.#open(properties) && this.#policy.removesSite(reporters, this.#backers());
  }

  // Every backer: the photo people, the photo's own reporters included, and the yes voters.
  #backers(): number {
    const { reporterIds, yesVoters } = this.#state.internals;
    return new Set([...reporterIds, ...yesVoters]).size;
  }

  static #open(properties: SiteProperties): boolean {
    return properties.verification === "unverified" && properties.status !== "removed";
  }
}
