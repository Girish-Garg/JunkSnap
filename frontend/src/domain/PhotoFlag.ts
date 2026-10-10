// photo_flag.schema.json and site.photo_flags in contracts v1.15 (decision 20261011-0310-hem-photo-flags).
import type { GpsFix } from './ReportUpload';
import type { SiteStatus } from './Site';

export const PHOTO_FLAG_TEXT_MAX = 200;

export const PHOTO_FLAG_REASONS = ['unrelated', 'person_or_property', 'duplicate', 'offensive'] as const;

export type PhotoFlagReason = (typeof PHOTO_FLAG_REASONS)[number];

/** One reported photo on a site: how many people reported it, and whether it is covered or hidden. */
export interface PhotoFlags {
  readonly photo_id: string;
  readonly count: number;
  readonly warned: boolean;
  readonly hidden: boolean;
}

export interface PhotoFlagRequest {
  readonly reason: PhotoFlagReason;
  readonly text?: string;
  readonly device_token: string;
  /** Like a vote: the api answers 403 too_far beyond 1 km of the site. */
  readonly gps: GpsFix;
}

/** The api never says who reported the photo or repeats the description. */
export interface PhotoFlagResult {
  readonly site_id: string;
  readonly photo_id: string;
  readonly reason: PhotoFlagReason;
  readonly text_status: 'none' | 'shown' | 'hidden';
  readonly photo: Omit<PhotoFlags, 'photo_id'>;
  readonly site_status: SiteStatus;
  readonly created_at: string;
}

// The S3 key layout: a report photo's public copy is media/reports/{report_id}.jpg.
const REPORT_PHOTO = /\/media\/reports\/(rpt_[a-z0-9_]{1,40})\.jpg$/;

/** A site photo's id, read from its public URL; null for an after-photo or any other URL. */
export class PhotoId {
  static fromUrl(url: string): string | null {
    return REPORT_PHOTO.exec(url)?.[1] ?? null;
  }
}
