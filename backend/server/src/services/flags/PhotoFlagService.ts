import type { PhotoFlag } from "../../contracts/index.gen.js";
import { NotFoundError } from "../../domain/errors.js";
import { OwnPhotoError, type FlagReason, type StoredPhotoFlag } from "../../domain/flags/PhotoFlag.js";
import type { Requester } from "../../domain/letters/types.js";
import type { Site } from "../../domain/sites/Site.js";
import { FLAG_RADIUS_M } from "../../domain/flags/PhotoFlagPolicy.js";
import type { GeoPoint } from "../../domain/sites/GeoPoint.js";
import { SiteNotFoundError, TooFarError } from "../../domain/sites/SiteErrors.js";
import type { PhotoFlagCount } from "../../domain/sites/SitePhotoFlags.js";
import type { SiteReportRef } from "../../domain/sites/Withdrawal.js";
import { personOf } from "../../domain/sites/utils.js";
import type { CommunityTrigger, PhotoFlagStore } from "../../ports/flags/PhotoFlagStore.js";
import type { NoteModerator } from "../../ports/moderation/NoteModerator.js";
import type { Clock } from "../../ports/sites/Clock.js";
import type { SiteReportReader } from "../../ports/sites/SiteReportReader.js";
import type { SiteRepository } from "../../ports/sites/SiteRepository.js";
import type { LetterRateLimiter } from "../letters/LetterRateLimiter.js";
import type { ConflictRetry } from "../sites/ConflictRetry.js";

export interface FlagRequest {
  readonly siteId: string;
  readonly photoId: string;
  readonly reason: FlagReason;
  // Trimmed; null without a description.
  readonly text: string | null;
  readonly requester: Requester;
  // Where the resident is now; like votes, photo reports need to come from within 1 km.
  readonly point: GeoPoint;
  // One-way hashes of the user id and device token; only these are stored.
  readonly authorHash: string;
  readonly deviceHash: string;
}

export interface PhotoFlagServiceDeps {
  readonly sites: SiteRepository;
  readonly rows: SiteReportReader;
  readonly flags: PhotoFlagStore;
  readonly limiter: LetterRateLimiter;
  readonly moderator: NoteModerator;
  readonly community: CommunityTrigger;
  readonly clock: Clock;
  readonly retry: ConflictRetry;
}

interface FlaggedPhoto {
  readonly url: string;
  readonly reporter: string;
}

interface Recorded {
  readonly photo: PhotoFlag["photo"];
  readonly status: PhotoFlag["site_status"];
  // This save warned the photo: concurrent reports may jump its count past PHOTO_FLAG_WARN.
  readonly firstWarned: boolean;
}

// Decision 20261011-0310-hem-photo-flags: records one person's report of a site photo, then recounts the photo.
export class PhotoFlagService {
  readonly #deps: PhotoFlagServiceDeps;

  constructor(deps: PhotoFlagServiceDeps) {
    this.#deps = deps;
  }

  async flag(request: FlagRequest): Promise<PhotoFlag> {
    const now = this.#deps.clock.now();
    const photo = await this.#photo(request, now);
    await this.#deps.limiter.take(request.requester, now);
    const stored = await this.#stored(request, now);
    await this.#deps.flags.put(stored);
    const count = { photoId: request.photoId, photoUrl: photo.url, reporter: photo.reporter, at: stored.createdAt };
    const site = await this.#deps.retry.run(() => this.#record(request.siteId, count, now));
    this.#tellCommunity(stored, site);
    const { siteId, photoId, reason, textStatus, moderation, createdAt } = stored;
    const result = { site_id: siteId, photo_id: photoId, reason, text_status: textStatus, moderation, created_at: createdAt };
    return { ...result, photo: site.photo, site_status: site.status };
  }

  // Descriptions count as signals only once several people reported the photo: on a new one, or when it is first warned.
  #tellCommunity(stored: StoredPhotoFlag, recorded: Recorded): void {
    if (recorded.firstWarned || (recorded.photo.warned && stored.textStatus === "shown")) {
      this.#deps.community.textAccepted(stored.siteId);
    }
  }

  // The photo must be one of the site's counted reports with a public copy; its own reporter cannot report it, and
  // like a voter the resident must be within 1 km of the site.
  async #photo(request: FlagRequest, now: Date): Promise<FlaggedPhoto> {
    const site = await this.#load(request.siteId, now);
    const rows = await this.#deps.rows.forSite(request.siteId);
    const row = rows.find((candidate) => candidate.reportId === request.photoId && site.reportIds.includes(candidate.reportId));
    const url = row?.photoUrl ?? null;
    if (row === undefined || url === null) {
      throw new NotFoundError(`No photo ${request.photoId} on this site`);
    }
    if (PhotoFlagService.#ownedBy(row, request.requester)) {
      throw new OwnPhotoError("You took this photo, so a neighbour has to report it");
    }
    if (site.point.distanceTo(request.point) > FLAG_RADIUS_M) {
      throw new TooFarError("You need to be within 1 km of the site to report its photos");
    }
    return { url, reporter: personOf(row) };
  }

  // A hidden or unchecked description is not stored; the report still counts.
  async #stored(request: FlagRequest, now: Date): Promise<StoredPhotoFlag> {
    const moderation = request.text === null ? null : await this.#deps.moderator.review(request.text);
    const textStatus = moderation === null ? "none" : moderation.result === "clean" ? "shown" : "hidden";
    const { siteId, photoId, authorHash, deviceHash, reason } = request;
    const text = textStatus === "shown" ? request.text : null;
    const createdAt = now.toISOString().replace(/\.\d{3}Z$/, "Z");
    return { siteId, photoId, authorHash, deviceHash, reason, text, textStatus, moderation, createdAt };
  }

  // Reports are re-read on every attempt, so a save that lost a race never writes back an older count.
  async #record(siteId: string, count: Omit<PhotoFlagCount, "authors">, now: Date): Promise<Recorded> {
    const site = await this.#load(siteId, now);
    const authors = await this.#deps.flags.authorsOf(siteId, count.photoId);
    const wasWarned = PhotoFlagService.#warned(site, count.photoId);
    const photo = site.recordPhotoFlags({ ...count, authors });
    await this.#deps.sites.save(site);
    return { photo, status: site.snapshot().feature.properties.status, firstWarned: photo.warned && !wasWarned };
  }

  static #warned(site: Site, photoId: string): boolean {
    const flags = site.snapshot().feature.properties.photo_flags ?? [];
    return flags.some((entry) => entry.photo_id === photoId && entry.warned);
  }

  async #load(siteId: string, now: Date): Promise<Site> {
    const site = await this.#deps.sites.get(siteId);
    if (site === null || site.isRemoved()) {
      throw new SiteNotFoundError(`No site ${siteId} on the map`);
    }
    site.assertActive(now);
    return site;
  }

  static #ownedBy(row: SiteReportRef, requester: Requester): boolean {
    return row.userId === requester.userId || row.deviceToken === requester.deviceToken;
  }
}
