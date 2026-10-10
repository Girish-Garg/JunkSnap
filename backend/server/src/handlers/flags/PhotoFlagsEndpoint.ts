import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { validatePhotoFlag, type PhotoFlag } from "../../contracts/index.gen.js";
import { InternalDataError, NotFoundError, ValidationError } from "../../domain/errors.js";
import { authorHash } from "../../domain/notes/AuthorHash.js";
import { GeoPoint } from "../../domain/sites/GeoPoint.js";
import type { PhotoFlagService } from "../../services/flags/PhotoFlagService.js";
import type { UserGuard } from "../letters/LettersEndpoint.js";

const SITE_ID = /^site_[a-z0-9_]{1,40}$/;
const PHOTO_ID = /^rpt_[a-z0-9_]{1,40}$/;
const MAX_TEXT = 200;

// contracts/README.md, photo flag request; a blank description counts as none.
const FlagBody = z.object({
  reason: z.enum(["unrelated", "person_or_property", "duplicate", "offensive"]),
  text: z.string().trim().max(MAX_TEXT).nullish(),
  device_token: z.uuid(),
  // Like a vote, a photo report comes from within 1 km of the site.
  gps: z.strictObject({ lat: z.number().min(-90).max(90), lon: z.number().min(-180).max(180), accuracy_m: z.number().min(0) }),
});

type FlagBody = z.output<typeof FlagBody>;

interface FlagParams {
  readonly id: string;
  readonly photo: string;
}

// POST /sites/{id}/photos/{photo}/flags: signed in; the answer never says who reported the photo or why.
export class PhotoFlagsEndpoint {
  readonly #service: PhotoFlagService;
  readonly #guard: UserGuard;

  constructor(service: PhotoFlagService, guard: UserGuard) {
    this.#service = service;
    this.#guard = guard;
  }

  plugin(): FastifyPluginAsync {
    return async (app) => {
      app.post<{ Params: FlagParams }>("/sites/:id/photos/:photo/flags", async (request) => {
        const user = await this.#guard.requireUser(request);
        const { id: siteId, photo: photoId } = request.params;
        if (!SITE_ID.test(siteId) || !PHOTO_ID.test(photoId)) {
          throw new NotFoundError("No such photo on that site");
        }
        const input = PhotoFlagsEndpoint.#parse(request.body);
        const deviceToken = input.device_token.toLowerCase();
        const flag = await this.#service.flag({
          siteId,
          photoId,
          reason: input.reason,
          text: PhotoFlagsEndpoint.#text(input),
          requester: { deviceToken, userId: user.userId },
          point: new GeoPoint(input.gps.lat, input.gps.lon),
          authorHash: authorHash(user.userId),
          deviceHash: authorHash(deviceToken),
        });
        return PhotoFlagsEndpoint.#checked(flag);
      });
    };
  }

  static #parse(body: unknown): FlagBody {
    const result = FlagBody.safeParse(body);
    if (!result.success) {
      throw new ValidationError(z.prettifyError(result.error));
    }
    return result.data;
  }

  static #text(input: FlagBody): string | null {
    const text = input.text ?? "";
    return text === "" ? null : text;
  }

  static #checked(flag: PhotoFlag): PhotoFlag {
    try {
      return validatePhotoFlag(flag);
    } catch (error) {
      throw new InternalDataError("Photo report breaks the photo_flag contract", { cause: error });
    }
  }
}
