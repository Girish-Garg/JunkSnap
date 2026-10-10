const NEEDED = 10;
// A no_bin site from before decision 20261010-1630 reads as a zone of this radius.
const ZONE_RADIUS = 1000;

// Items written before decision 20261010-1530 read as the new shape until the backers migration rewrites them.
export class LegacySiteFields {
  upgrade(item: Record<string, unknown>): Record<string, unknown> {
    const verification = item.verification === "community_check" ? "unverified" : item.verification;
    const zone = item.report_type === "no_bin" && item.zone_radius_m === undefined ? { zone_radius_m: ZONE_RADIUS } : {};
    return { ...item, ...zone, verification, backers: item.backers ?? LegacySiteFields.#provisionalBackers(item) };
  }

  // Until the migration recounts them, the people who sent photos are the only known backers.
  static #provisionalBackers(item: Record<string, unknown>): Record<string, number> {
    const ids = Array.isArray(item.reporter_ids) ? item.reporter_ids.length : 0;
    const photoPeople = Math.max(ids, typeof item.reporters === "number" ? item.reporters : 1);
    return { count: photoPeople, needed: NEEDED, photo_people: photoPeople, vote_people: 0 };
  }
}
