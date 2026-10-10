import type { SiteProperties } from '../../domain/Site';
import { SiteLifecycle } from '../../domain/SiteLifecycle';
import { UlidTime } from '../../domain/UlidTime';
import { SiteClosure, type ClosedReason } from './SiteClosure';

export interface BadgeView {
  readonly key: string;
  readonly tone: 'alert' | 'plain';
  readonly params?: Readonly<Record<string, number>>;
}

export interface PhotoView {
  readonly url: string;
  readonly altKey: string;
  readonly altParams: Readonly<Record<string, number>>;
  /** When the photo was reported, from the ULID in its id; null when the URL carries none. */
  readonly reportedAt: string | null;
}

export type PrimaryAction = 'confirm' | 'letter';

/** Display rules for one site, kept out of the components. */
export class SitePresenter {
  readonly #site: SiteProperties;

  constructor(site: SiteProperties) {
    this.#site = site;
  }

  badges(): readonly BadgeView[] {
    const badges: BadgeView[] = [];
    if (this.#site.burning) badges.push({ key: 'site.burning', tone: 'alert' });
    if (this.#site.cleanup_status === 'checking') badges.push({ key: 'site.cleanupChecking', tone: 'plain' });
    const pending = new SiteLifecycle(this.#site).pendingClearance();
    if (pending) badges.push({ key: 'site.reportedCleaned', tone: 'plain', params: { count: pending.count, needed: pending.needed } });
    if (this.#site.pilot) badges.push({ key: 'site.pilot', tone: 'plain' });
    return badges;
  }

  /** Blurred public copies, newest first, then the last cleanup after-photo. */
  photos(): readonly PhotoView[] {
    const total = this.#site.photo_urls.length;
    const reports = this.#site.photo_urls.map((url, index) => ({
      url,
      altKey: 'site.photoAlt',
      altParams: { n: index + 1, total },
      reportedAt: UlidTime.fromPhotoUrl(url),
    }));
    const cleanup = this.#site.cleanup_photo_url;
    return cleanup ? [...reports, { url: cleanup, altKey: 'site.afterCleanup', altParams: {}, reportedAt: UlidTime.fromPhotoUrl(cleanup) }] : reports;
  }

  thumbnail(): string | null {
    return this.#site.photo_urls[0] ?? null;
  }

  /** An unverified site needs people to back it; a verified one is ready for a letter. */
  primaryAction(): PrimaryAction {
    return this.#site.verification === 'unverified' ? 'confirm' : 'letter';
  }

  /** Why the site takes no votes, photos or letters any more; null while it is on the map. */
  closedReason(): ClosedReason | null {
    return SiteClosure.reasonOf(this.#site);
  }

  /** The api drafts a letter only for a verified site (10 people; decision 20261010-1530) that is still on the map. */
  letterReady(): boolean {
    return this.#site.verification === 'verified' && this.closedReason() === null;
  }

  /** The status chip says verified or waiting only for an open site; any other status spells it out beside the chip. */
  showsVerification(): boolean {
    return this.#site.status !== 'open';
  }

  /** "n of 10 people confirmed" means nothing once a site is off the map, unless it was verified first. */
  showsBackers(): boolean {
    return this.closedReason() === null || this.#site.verification === 'verified';
  }
}
