import type { SiteProperties } from '../../domain/Site';
import { UlidTime } from '../../domain/UlidTime';

export interface BadgeView {
  readonly key: string;
  readonly tone: 'alert' | 'plain';
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

  /** A site waiting for neighbours needs confirmations; a verified one is ready for a letter. */
  primaryAction(): PrimaryAction {
    return this.#site.verification === 'community_check' ? 'confirm' : 'letter';
  }
}
