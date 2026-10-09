import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { channelSchema } from "../../adapters/letters/vocabulary.js";
import { validateLetterDraft, type LetterDraft } from "../../contracts/index.gen.js";
import { InternalDataError, NotFoundError, ValidationError } from "../../domain/errors.js";
import type { LetterService } from "../../services/letters/LetterService.js";

const SITE_ID = /^site_[a-z0-9_]{1,40}$/;

const LetterBody = z.object({
  device_token: z.uuid(),
  channel: channelSchema,
  language: z.enum(["en", "hi"]),
});

type LetterBody = z.output<typeof LetterBody>;

// POST /sites/{id}/letters: a draft for the resident to file; JunkSnap never files anything.
export class LettersEndpoint {
  readonly #service: LetterService;

  constructor(service: LetterService) {
    this.#service = service;
  }

  plugin(): FastifyPluginAsync {
    return async (app) => {
      app.post<{ Params: { id: string } }>("/sites/:id/letters", async (request) => {
        const userId = null; // Auth seam: (await guard.requireUser(request)).userId once sign-in lands.
        return this.#draft(request.params.id, request.body, userId);
      });
    };
  }

  async #draft(siteId: string, body: unknown, userId: string | null): Promise<LetterDraft> {
    if (!SITE_ID.test(siteId)) {
      throw new NotFoundError(`No site ${siteId}`);
    }
    const input = LettersEndpoint.#parse(body);
    const draft = await this.#service.draft({
      siteId,
      channel: input.channel,
      language: input.language,
      requester: { deviceToken: input.device_token.toLowerCase(), userId },
    });
    return LettersEndpoint.#checked(draft);
  }

  static #parse(body: unknown): LetterBody {
    const result = LetterBody.safeParse(body);
    if (!result.success) {
      throw new ValidationError(z.prettifyError(result.error));
    }
    return result.data;
  }

  // The schema cannot compare counts, so the verifier totals are checked here before anything leaves.
  static #checked(draft: LetterDraft): LetterDraft {
    const { verified, total } = draft.verifier;
    if (verified !== total || total !== draft.citations.length) {
      throw new InternalDataError(`Letter verifier ${verified} of ${total} for ${draft.citations.length} citations`);
    }
    try {
      return validateLetterDraft(draft);
    } catch (error) {
      throw new InternalDataError("Letter draft breaks the letter_draft contract", { cause: error });
    }
  }
}
