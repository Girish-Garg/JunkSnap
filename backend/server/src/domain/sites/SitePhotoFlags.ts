import type { FlagAuthor, PhotoFlagState } from "../flags/PhotoFlag.js";
import { PhotoFlagPolicy } from "../flags/PhotoFlagPolicy.js";
import { ReportedPhotoRemoval } from "./ReportedPhotoRemoval.js";
import type { SiteProperties, SiteState } from "./SiteTypes.js";
import { newestPhotos } from "./utils.js";

type PhotoFlags = NonNullable<SiteProperties["photo_flags"]>;

// The current reports of one photo of the site.
export interface PhotoFlagCount {
  readonly photoId: string;
  // The photo's public blurred copy, left out of photo_urls once hidden.
  readonly photoUrl: string;
  // The photo's reporter: the user id, else the device token; they never back their own photo here.
  readonly reporter: string;
  readonly authors: readonly FlagAuthor[];
  readonly at: string;
}

// Decision 20261011-0310-hem-photo-flags: records a photo's reports on the site; hidden photos leave photo_urls,
// and an unverified site whose every remaining report is a hidden photo may be removed (ReportedPhotoRemoval).
export class SitePhotoFlags {
  readonly #state: SiteState;
  readonly #count: PhotoFlagCount;
  readonly #policy = new PhotoFlagPolicy();

  constructor(state: SiteState, count: PhotoFlagCount) {
    this.#state = state;
    this.#count = count;
  }

  photo(): PhotoFlagState {
    const { photo_flags: flags = [] } = this.#state.feature.properties;
    const wasHidden = flags.some((entry) => entry.photo_id === this.#count.photoId && entry.hidden);
    return this.#policy.state(this.#policy.people(this.#count.authors), this.#backers(), wasHidden);
  }

  apply(): SiteState {
    const { feature } = this.#state;
    const photo = this.photo();
    const others = (feature.properties.photo_flags ?? []).filter((entry) => entry.photo_id !== this.#count.photoId);
    const photoFlags: PhotoFlags = [...others, { photo_id: this.#count.photoId, ...photo }];
    const kept = feature.properties.photo_urls.filter((url) => !photo.hidden || url !== this.#count.photoUrl);
    const properties = { ...feature.properties, photo_flags: photoFlags, photo_urls: newestPhotos(kept) };
    const flagged = { ...this.#state, feature: { ...feature, properties } };
    return new ReportedPhotoRemoval(flagged).apply(this.#count.at);
  }

  // Backers other than the photo's reporter: the photo people and the yes voters.
  #backers(): number {
    const { reporterIds, yesVoters } = this.#state.internals;
    const people = new Set([...reporterIds, ...yesVoters]);
    people.delete(this.#count.reporter);
    return people.size;
  }
}
