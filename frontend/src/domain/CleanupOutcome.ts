import type { SiteProperties } from './Site';

/** What became of one after-photo: still being checked, counted as one cleared word, the site cleared, or not accepted. */
export type CleanupResult = 'checking' | 'pending_confirmation' | 'accepted' | 'rejected';

export type CleanupFields = Pick<SiteProperties, 'cleanup_status' | 'cleanup_photo_url'>;

/**
 * Decides one after-photo's result by its cleanup_id (the 202 of POST /sites/{id}/cleanup). The site shows only the
 * latest photo that passed (cleanup_photo_url, the blurred copy at media/cleanups/{cleanup_id}.jpg), and a rejected
 * photo leaves an earlier person's pending_confirmation in place, so cleanup_status alone cannot tell.
 */
export class CleanupOutcome {
  static of(site: CleanupFields, cleanupId: string): CleanupResult {
    const status = site.cleanup_status;
    if (status === 'checking') return 'checking';
    if (CleanupOutcome.#passed(site.cleanup_photo_url, cleanupId)) return status === 'accepted' ? 'accepted' : 'pending_confirmation';
    // Still none: the claim has not shown up yet. Anything else: the photos that passed are someone else's.
    return status === 'none' ? 'checking' : 'rejected';
  }

  static #passed(url: string | null, cleanupId: string): boolean {
    return url !== null && url.endsWith(`/media/cleanups/${cleanupId}.jpg`);
  }
}
