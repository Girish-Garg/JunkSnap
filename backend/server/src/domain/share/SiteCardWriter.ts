import type { ReportType, SiteFeature, SiteLocation } from "../sites/SiteTypes.js";
import type { ShareCard } from "./ShareCard.js";
import type { ShareUrls } from "./ShareUrls.js";

// The app's English report type labels (frontend/src/i18n/en.json, reportType).
const TYPE_LABELS: Readonly<Record<ReportType, string>> = {
  waste_dump: "Waste dump",
  no_bin: "No bin or pickup",
  contaminated_water: "Contaminated water",
  open_construction: "Open construction",
  overflowing_bin: "Overflowing or broken bin",
};
// Left out of the map: the card says so and shows no photo.
const GONE = new Set(["removed", "expired"]);
const DAY_MONTH = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", timeZone: "Asia/Kolkata" });
const SEPARATOR = " · ";

// Neutral English text from the site's own fields; places and seats only, never a person.
export class SiteCardWriter {
  readonly #urls: ShareUrls;

  constructor(urls: ShareUrls) {
    this.#urls = urls;
  }

  card(site: SiteFeature): ShareCard {
    const p = site.properties;
    if (GONE.has(p.status) || p.verification === "rejected") {
      return this.gone(p.site_id);
    }
    const photo = this.#urls.blurredPhoto(p.photo_urls);
    const title = [TYPE_LABELS[p.report_type], SiteCardWriter.#place(p.location)].filter(Boolean).join(SEPARATOR);
    const image = photo === null ? this.#urls.logo() : { url: photo, alt: "Blurred photo of the reported waste", large: true };
    return { ...this.#links(p.site_id), status: 200, title, description: this.#description(site), image };
  }

  // A removed, expired or rejected site: no photo and no details, but the link still opens.
  gone(siteId: string): ShareCard {
    const title = "A waste report on JunkSnap";
    const description = "This report is no longer on the map. Open JunkSnap to see waste reported near you.";
    return { ...this.#links(siteId), status: 200, title, description, image: this.#urls.logo() };
  }

  unknown(siteId: string): ShareCard {
    const description = "Community-reported waste sites, checked by models and confirmed by neighbours.";
    const links = { pageUrl: this.#urls.sharedSite(siteId), appUrl: this.#urls.appHome() };
    return { ...links, status: 404, title: "JunkSnap", description, image: this.#urls.logo() };
  }

  #links(siteId: string): Pick<ShareCard, "pageUrl" | "appUrl"> {
    return { pageUrl: this.#urls.sharedSite(siteId), appUrl: this.#urls.appSite(siteId) };
  }

  #description(site: SiteFeature): string {
    const p = site.properties;
    const reported = `reported ${DAY_MONTH.format(new Date(p.first_reported_at))}`;
    return [SiteCardWriter.#progress(site), reported].join(SEPARATOR);
  }

  static #progress(site: SiteFeature): string {
    const { status, verification, backers } = site.properties;
    if (status === "cleaned") {
      return "Reported cleared";
    }
    if (verification === "verified") {
      return `Verified by ${backers.needed} people`;
    }
    return `${backers.count} of ${backers.needed} people confirmed`;
  }

  // "Soorsagar, Jodhpur": the ward or assembly seat, then the town or district, without repeats.
  static #place(location: SiteLocation): string {
    const local = location.ward?.name ?? location.assembly_seat?.name ?? null;
    const wider = location.town ?? location.district.name;
    return [...new Set([local, wider].filter((name): name is string => Boolean(name)))].join(", ");
  }
}
