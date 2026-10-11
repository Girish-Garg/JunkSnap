import type { PhotoUrls, SiteBrand, SiteInternals, Voter } from "./SiteTypes.js";

const MAX_PHOTOS = 6;

// Newest first, capped at the schema's six; slice makes the tuple cast safe.
export function newestPhotos(urls: readonly string[]): PhotoUrls {
  return [...new Set(urls)].slice(0, MAX_PHOTOS) as PhotoUrls;
}

// One entry per brand, keeping its highest confidence.
export function mergeBrands(current: readonly SiteBrand[], added: readonly SiteBrand[]): SiteBrand[] {
  const byBrand = new Map<string, SiteBrand>();
  for (const label of [...current, ...added]) {
    const kept = byBrand.get(label.brand);
    byBrand.set(label.brand, kept && kept.confidence >= label.confidence ? kept : label);
  }
  return [...byBrand.values()];
}

export function withItem(items: readonly string[], item: string): readonly string[] {
  return items.includes(item) ? items : [...items, item];
}

export function earlierTime(a: string, b: string): string {
  return Date.parse(b) < Date.parse(a) ? b : a;
}

export function laterTime(a: string, b: string): string {
  return Date.parse(b) > Date.parse(a) ? b : a;
}

// Same user, or same device for a guest from before accounts (the own_site rule).
export function reportedBy(site: Pick<SiteInternals, "reporterDevices" | "reporterUsers">, voter: Voter): boolean {
  const sameUser = voter.userId !== null && site.reporterUsers.includes(voter.userId);
  return sameUser || site.reporterDevices.includes(voter.deviceToken);
}

// For messages: 1000 reads "1 km", 40 reads "40 m".
export function distanceText(metres: number): string {
  return metres % 1000 === 0 ? `${metres / 1000} km` : `${metres} m`;
}

// A person is a user id, else a device token (decision 20261010-1530).
export function personOf(voter: Voter): string {
  return voter.userId ?? voter.deviceToken;
}
