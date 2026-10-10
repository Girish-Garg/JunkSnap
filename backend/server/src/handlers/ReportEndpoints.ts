import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { validateReportUpload } from "../contracts/index.gen.js";
import { ValidationError } from "../domain/errors.js";
import type { MyReportsQuery } from "../services/MyReportsQuery.js";
import type { ReportIntake } from "../services/ReportIntake.js";
import type { ReportStatusReader } from "../services/ReportStatusReader.js";
import type { PresignRequest, UploadPresigner } from "../services/UploadPresigner.js";
import type { RouteGuard } from "./auth/RouteGuard.js";

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

const PresignBody = z.strictObject({
  purpose: z.enum(["report", "cleanup"]),
  content_type: z.literal("image/jpeg"),
  sha256: z.string().regex(/^[0-9a-f]{64}$/),
  device_token: z.string().regex(UUID_V4),
});

// GET /me/reports: 20 a page by default, at most 50; the cursor is the opaque next_cursor of the page before.
const MineQuery = z.strictObject({
  limit: z.coerce.number().int().min(1).max(50).default(20),
  cursor: z.string().regex(/^[A-Za-z0-9_-]{1,1024}$/).optional(),
});

// Creating needs a signed-in user (decision 0227); GET also opens a guest report made before accounts by its device.
export type ReportGuard = Pick<RouteGuard, "requireUser" | "optionalUser">;

export interface ReportServices {
  readonly presigner: UploadPresigner;
  readonly intake: ReportIntake;
  readonly statuses: ReportStatusReader;
  readonly mine: MyReportsQuery;
}

export class ReportEndpoints {
  readonly #services: ReportServices;
  readonly #guard: ReportGuard;

  constructor(services: ReportServices, guard: ReportGuard) {
    this.#services = services;
    this.#guard = guard;
  }

  plugin(): FastifyPluginAsync {
    const { presigner, intake, statuses, mine } = this.#services;
    const guard = this.#guard;
    return async (app) => {
      app.post("/uploads/presign", async (request) => {
        const user = await guard.requireUser(request);
        return presigner.presign(ReportEndpoints.#presignBody(request.body), user.userId);
      });
      app.post("/reports", async (request, reply) => {
        const user = await guard.requireUser(request);
        const accepted = await intake.submit(validateReportUpload(request.body), user.userId);
        return reply.status(202).send(accepted);
      });
      app.get<{ Params: { id: string } }>("/reports/:id", async (request) => {
        const user = await guard.optionalUser(request);
        const token = request.headers["x-device-token"];
        const viewer = { userId: user?.userId, deviceToken: typeof token === "string" ? token : undefined };
        return statuses.read(request.params.id, viewer);
      });
      app.get("/me/reports", async (request) => {
        const user = await guard.requireUser(request);
        const query = ReportEndpoints.#parse(MineQuery, request.query);
        return mine.list(user.userId, { limit: query.limit, cursor: query.cursor ?? null });
      });
    };
  }

  static #presignBody(body: unknown): PresignRequest {
    return ReportEndpoints.#parse(PresignBody, body);
  }

  static #parse<T extends z.ZodType>(schema: T, input: unknown): z.infer<T> {
    const parsed = schema.safeParse(input);
    if (!parsed.success) {
      throw new ValidationError(z.prettifyError(parsed.error));
    }
    return parsed.data;
  }
}
