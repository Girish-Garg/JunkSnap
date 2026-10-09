import { z } from "zod";
import { ValidationError } from "../../domain/errors.js";
import { BoundingBox } from "../../domain/sites/BoundingBox.js";
import type { CleanupRequest } from "../../domain/sites/Cleanup.js";
import { GeoPoint } from "../../domain/sites/GeoPoint.js";
import { SiteNotFoundError } from "../../domain/sites/SiteErrors.js";
import type { Ballot } from "../../services/sites/VoteService.js";

const SITE_ID = /^site_[a-z0-9_]{1,40}$/;
const DEVICE_TOKEN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

const Gps = z.strictObject({
  lat: z.number().min(-90).max(90),
  lon: z.number().min(-180).max(180),
  accuracy_m: z.number().min(0),
});
// Auth in contracts/README.md: a user_id in a body is ignored; only the verified token's sub counts.
const IgnoredUserId = z.unknown().optional();
const SiteParams = z.object({ id: z.string() });
const BboxQuery = z.object({ bbox: z.string() });
const VoteBody = z.strictObject({
  device_token: z.string().regex(DEVICE_TOKEN),
  vote: z.enum(["confirm", "reject"]),
  gps: Gps,
  user_id: IgnoredUserId,
});
const CleanupBody = z.strictObject({
  upload_id: z.string().regex(/^upl_[a-z0-9_]{1,40}$/),
  device_token: z.string().regex(DEVICE_TOKEN),
  sha256: z.string().regex(/^[0-9a-f]{64}$/),
  gps: Gps,
  captured_at: z.iso.datetime(),
  user_id: IgnoredUserId,
});

// Request shapes from contracts/README.md; a bad shape is 400 bad_request, a malformed site id 404.
export class SiteRequests {
  siteId(params: unknown): string {
    const parsed = SiteParams.safeParse(params);
    if (!parsed.success || !SITE_ID.test(parsed.data.id)) {
      throw new SiteNotFoundError("No site with that id");
    }
    return parsed.data.id;
  }

  bbox(query: unknown): BoundingBox {
    return BoundingBox.parse(SiteRequests.#parse(BboxQuery, query, "query").bbox);
  }

  ballot(body: unknown, userId: string | null): Ballot {
    const { device_token, vote, gps } = SiteRequests.#parse(VoteBody, body, "vote");
    return { deviceToken: device_token, userId, choice: vote, point: new GeoPoint(gps.lat, gps.lon) };
  }

  cleanup(body: unknown): CleanupRequest {
    const { upload_id, device_token, sha256, gps, captured_at } = SiteRequests.#parse(CleanupBody, body, "cleanup");
    return { upload_id, device_token, sha256, gps, captured_at };
  }

  static #parse<S extends z.ZodType>(schema: S, value: unknown, what: string): z.output<S> {
    const result = schema.safeParse(value);
    if (!result.success) {
      throw new ValidationError(`${what}: ${z.prettifyError(result.error)}`);
    }
    return result.data;
  }
}
