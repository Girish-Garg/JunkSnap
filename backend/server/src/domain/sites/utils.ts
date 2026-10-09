import type { PhotoUrls, SiteBrand } from "./SiteTypes.js";

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

export function earlierTime(a: string, b: string): string {
  return Date.parse(b) < Date.parse(a) ? b : a;
}

export function laterTime(a: string, b: string): string {
  return Date.parse(b) > Date.parse(a) ? b : a;
}
