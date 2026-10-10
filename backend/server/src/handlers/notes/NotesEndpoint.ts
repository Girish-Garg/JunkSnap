import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { validateSiteNote, type SiteNote } from "../../contracts/index.gen.js";
import { InternalDataError, NotFoundError, ValidationError } from "../../domain/errors.js";
import { authorHash } from "../../domain/notes/AuthorHash.js";
import type { NoteService } from "../../services/notes/NoteService.js";
import type { UserGuard } from "../letters/LettersEndpoint.js";

const SITE_ID = /^site_[a-z0-9_]{1,40}$/;
const CREATED = 201;

const NoteBody = z.object({
  text: z.string().trim().min(1).max(280),
  language: z.enum(["en", "hi"]),
  device_token: z.uuid(),
});

type NoteBody = z.output<typeof NoteBody>;

// POST /sites/{id}/notes: signed in; the answer says whether the note is shown, never who wrote it.
export class NotesEndpoint {
  readonly #service: NoteService;
  readonly #guard: UserGuard;

  constructor(service: NoteService, guard: UserGuard) {
    this.#service = service;
    this.#guard = guard;
  }

  plugin(): FastifyPluginAsync {
    return async (app) => {
      app.post<{ Params: { id: string } }>("/sites/:id/notes", async (request, reply) => {
        const user = await this.#guard.requireUser(request);
        const siteId = request.params.id;
        if (!SITE_ID.test(siteId)) {
          throw new NotFoundError(`No site ${siteId}`);
        }
        const input = NotesEndpoint.#parse(request.body);
        const note = await this.#service.add({
          siteId,
          text: input.text,
          language: input.language,
          requester: { deviceToken: input.device_token.toLowerCase(), userId: user.userId },
          authorHash: authorHash(user.userId),
        });
        return reply.status(CREATED).send(NotesEndpoint.#checked(note));
      });
    };
  }

  static #parse(body: unknown): NoteBody {
    const result = NoteBody.safeParse(body);
    if (!result.success) {
      throw new ValidationError(z.prettifyError(result.error));
    }
    return result.data;
  }

  static #checked(note: SiteNote): SiteNote {
    try {
      return validateSiteNote(note);
    } catch (error) {
      throw new InternalDataError("Note breaks the site_note contract", { cause: error });
    }
  }
}
