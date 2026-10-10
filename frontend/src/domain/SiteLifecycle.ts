import type { SiteClearance, SiteProperties } from './Site';

const DAY_MS = 86_400_000;
// Only a site still on the map waits for clearing or can expire.
const ACTIVE: ReadonlySet<string> = new Set(['open', 'reopened']);

type LifecycleFields = Pick<SiteProperties, 'status' | 'clearance' | 'expires_at'>;

/** Decision 20261010-1855: 3 different people clear a site; a site expires 90 days after its last activity. */
export class SiteLifecycle {
  readonly #site: LifecycleFields;

  constructor(site: LifecycleFields) {
    this.#site = site;
  }

  /** Someone said it is cleared (an after-photo or a vote) and the site waits for more people; null otherwise. */
  pendingClearance(): SiteClearance | null {
    const clearance = this.#site.clearance;
    return ACTIVE.has(this.#site.status) && clearance && clearance.count > 0 ? clearance : null;
  }

  /** Whole days left before the site expires, never below 0; null when it cannot expire or the server sent no date. */
  daysLeft(nowMs: number): number | null {
    const expiresAt = this.#site.expires_at;
    if (!ACTIVE.has(this.#site.status) || !expiresAt) return null;
    return Math.max(0, Math.ceil((Date.parse(expiresAt) - nowMs) / DAY_MS));
  }

  /** Still on the active map: takes votes, cleanups and letters, and can be cleared or expire. */
  isActive(): boolean {
    return ACTIVE.has(this.#site.status);
  }
}
