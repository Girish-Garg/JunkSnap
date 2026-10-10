import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { validateAreaLetterDraft, type AreaLetterDraft } from "../../contracts/index.gen.js";
import { AreaKey } from "../../domain/AreaKey.js";
import { InternalDataError, ValidationError } from "../../domain/errors.js";
import type { AreaLetterService } from "../../services/letters/AreaLetterService.js";
import type { UserGuard } from "./LettersEndpoint.js";

const AreaLetterBody = z.object({
  issue: z.enum(["waste_dump", "no_bin", "contaminated_water", "open_construction", "overflowing_bin", "all"]),
  language: z.enum(["en", "hi"]),
  device_token: z.uuid(),
});

type AreaLetterBody = z.output<typeof AreaLetterBody>;

interface AreaParams {
  readonly kind: string;
  readonly id: string;
}

export class AreaLettersEndpoint {
  readonly #service: AreaLetterService;
  readonly #guard: UserGuard;

  constructor(service: AreaLetterService, guard: UserGuard) {
    this.#service = service;
    this.#guard = guard;
  }

  plugin(): FastifyPluginAsync {
    return async (app) => {
      app.post<{ Params: AreaParams }>("/areas/:kind/:id/letters", async (request) => {
        const user = await this.#guard.requireUser(request);
        const area = AreaKey.parse(request.params.kind, request.params.id);
        const input = AreaLettersEndpoint.#parse(request.body);
        const draft = await this.#service.draft({
          area,
          issue: input.issue,
          language: input.language,
          requester: { deviceToken: input.device_token.toLowerCase(), userId: user.userId },
        });
        return AreaLettersEndpoint.#checked(draft);
      });
    };
  }

  static #parse(body: unknown): AreaLetterBody {
    const result = AreaLetterBody.safeParse(body);
    if (!result.success) {
      throw new ValidationError(z.prettifyError(result.error));
    }
    return result.data;
  }

  // The schema cannot compare counts, so the verifier totals are checked here before anything leaves.
  static #checked(draft: AreaLetterDraft): AreaLetterDraft {
    const { verified, total } = draft.verifier;
    if (verified !== total || total !== draft.citations.length) {
      throw new InternalDataError(`Area letter verifier ${verified} of ${total} for ${draft.citations.length} citations`);
    }
    try {
      return validateAreaLetterDraft(draft);
    } catch (error) {
      throw new InternalDataError("Area letter draft breaks the area_letter_draft contract", { cause: error });
    }
  }
}
