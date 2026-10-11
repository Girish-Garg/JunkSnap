import type { PhotoUrls, SiteProperties } from "./SiteTypes.js";
import { newestPhotos } from "./utils.js";

type PhotoFields = Pick<SiteProperties, "photo_urls" | "photo_flags">;

// A photo's id is the report id in its blurred key, media/reports/{report_id}.jpg.
const PHOTO_ID = /\/(rpt_[a-z0-9_]{1,40})\.jpg(?:[?#]|$)/;

// Contracts v1.15: a warned photo is shown only after a tap and a hidden one never, so neither goes in a card or a letter.
export class ShareablePhotos {
  readonly #fields: PhotoFields;

  constructor(fields: PhotoFields) {
    this.#fields = fields;
  }

  urls(): PhotoUrls {
    const flagged = (this.#fields.photo_flags ?? []).filter((entry) => entry.warned || entry.hidden);
    const ids = new Set(flagged.map((entry) => entry.photo_id));
    return newestPhotos(this.#fields.photo_urls.filter((url) => !ids.has(PHOTO_ID.exec(url)?.[1] ?? "")));
  }
}
