import type { FastifyPluginAsync, FastifyRequest } from "fastify";
import { z } from "zod";
import { validateReportUpload } from "../contracts/index.gen.js";
import { ValidationError } from "../domain/errors.js";
import type { ReportIntake } from "../services/ReportIntake.js";
import type { ReportStatusReader } from "../services/ReportStatusReader.js";
import type { PresignRequest, UploadPresigner } from "../services/UploadPresigner.js";

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

const PresignBody = z.strictObject({
  purpose: z.enum(["report", "cleanup"]),
  content_type: z.literal("image/jpeg"),
  sha256: z.string().regex(/^[0-9a-f]{64}$/),
  device_token: z.string().regex(UUID_V4),
});

export interface SignedInUser {
  readonly userId: string;
}

// The shape of the auth task's RouteGuard, so it plugs in unchanged.
export interface ReportGuard {
  requireUser(request: Pick<FastifyRequest, "headers">): Promise<SignedInUser | undefined>;
  optionalUser(request: Pick<FastifyRequest, "headers">): Promise<SignedInUser | undefined>;
}

export interface ReportServices {
  readonly presigner: UploadPresigner;
  readonly intake: ReportIntake;
  readonly statuses: ReportStatusReader;
}

export class ReportEndpoints {
  readonly #services: ReportServices;
  readonly #guard: ReportGuard;

  constructor(services: ReportServices, guard: ReportGuard) {
    this.#services = services;
    this.#guard = guard;
  }

  plugin(): FastifyPluginAsync {
    const { presigner, intake, statuses } = this.#services;
    const guard = this.#guard;
    return async (app) => {
      app.post("/uploads/presign", async (request) => {
        const user = await guard.requireUser(request);
        return presigner.presign(ReportEndpoints.#presignBody(request.body), user?.userId);
      });
      app.post("/reports", async (request, reply) => {
        const user = await guard.requireUser(request);
        const accepted = await intake.submit(validateReportUpload(request.body), user?.userId);
        return reply.status(202).send(accepted);
      });
      app.get<{ Params: { id: string } }>("/reports/:id", async (request) => {
        const user = await guard.optionalUser(request);
        const token = request.headers["x-device-token"];
        const viewer = { userId: user?.userId, deviceToken: typeof token === "string" ? token : undefined };
        return statuses.read(request.params.id, viewer);
      });
    };
  }

  static #presignBody(body: unknown): PresignRequest {
    const parsed = PresignBody.safeParse(body);
    if (!parsed.success) {
      throw new ValidationError(z.prettifyError(parsed.error));
    }
    return parsed.data;
  }
}
