import { PhotoId } from '../../domain/PhotoFlag';
import type { SiteProperties } from '../../domain/Site';
import { SiteLifecycle } from '../../domain/SiteLifecycle';
import { SiteStatusChip, type ChipView } from '../../domain/SiteStatusChip';
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
  /** The report id residents can report this photo by; null for the after-photo. */
  readonly photoId: string | null;
  /** Several people reported it (decision 20261011-0310-hem-photo-flags): shown only after a tap. */
  readonly warned: boolean;
}

export type PrimaryAction = 'confirm' | 'letter';

// A no-bin zone "is cleared" when a bin is there now, so its clearing words have their own text.
const NO_BIN_WORDS: ReadonlySet<string> = new Set(['explain.clearing', 'explain.cleared']);

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
    const warned = new Set((this.#site.photo_flags ?? []).filter((flags) => flags.warned).map((flags) => flags.photo_id));
    const reports = this.#site.photo_urls.map((url, index) => {
      const photoId = PhotoId.fromUrl(url);
      const reportedAt = UlidTime.fromPhotoUrl(url);
      return { url, altKey: 'site.photoAlt', altParams: { n: index + 1, total }, reportedAt, photoId, warned: photoId !== null && warned.has(photoId) };
    });
    const cleanup = this.#site.cleanup_photo_url;
    if (!cleanup) return reports;
    return [...reports, { url: cleanup, altKey: 'site.afterCleanup', altParams: {}, reportedAt: UlidTime.fromPhotoUrl(cleanup), photoId: null, warned: false }];
  }

  /** The newest photo nobody has covered; a warned photo never shows uncovered in a card or list row. */
  thumbnail(): string | null {
    const warned = new Set(this.photos().flatMap((photo) => (photo.warned ? [photo.url] : [])));
    return this.#site.photo_urls.find((url) => !warned.has(url)) ?? null;
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

  /** Still on the map and gathering its 10 people, so neighbours can be asked to confirm it. */
  waitsForBackers(): boolean {
    const { verification } = this.#site;
    return verification !== 'verified' && verification !== 'rejected' && new SiteLifecycle(this.#site).isActive();
  }

  /**
   * The plain words behind a status chip (explain.*): a verified site off the map promises no letter, and a no-bin
   * zone is cleared by a bin, not a cleanup.
   */
  explainKey(chip: ChipView): string {
    const key = SiteStatusChip.explainKey(chip);
    if (key === 'explain.verified' && this.closedReason() !== null) return 'explain.verifiedClosed';
    return this.#site.report_type === 'no_bin' && NO_BIN_WORDS.has(key) ? `${key}NoBin` : key;
  }

  /** "n of 10 people confirmed" means nothing once a site is off the map, unless it was verified first. */
  showsBackers(): boolean {
    return this.closedReason() === null || this.#site.verification === 'verified';
  }
}
