const NEEDED = 10;

// Items written before decision 20261010-1530 read as the new shape until the backers migration rewrites them.
export class LegacySiteFields {
  upgrade(item: Record<string, unknown>): Record<string, unknown> {
    const verification = item.verification === "community_check" ? "unverified" : item.verification;
    return { ...item, verification, backers: item.backers ?? LegacySiteFields.#provisionalBackers(item) };
  }

  // Until the migration recounts them, the people who sent photos are the only known backers.
  static #provisionalBackers(item: Record<string, unknown>): Record<string, number> {
    const ids = Array.isArray(item.reporter_ids) ? item.reporter_ids.length : 0;
    const photoPeople = Math.max(ids, typeof item.reporters === "number" ? item.reporters : 1);
    return { count: photoPeople, needed: NEEDED, photo_people: photoPeople, vote_people: 0 };
  }
}
