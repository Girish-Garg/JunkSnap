import type { FastifyPluginAsync, FastifyRequest } from "fastify";
import { z } from "zod";
import { ValidationError } from "../domain/errors.js";
import type { ReportStatusView } from "../domain/ReportRecord.js";
import type { ReportConfirmer } from "../services/ReportConfirmer.js";
import type { RouteGuard } from "./auth/RouteGuard.js";

const DEVICE_TOKEN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
// Confirm request (contracts v1.16): {"sure": true} or {"sure": false}, nothing else.
const ConfirmBody = z.strictObject({ sure: z.boolean() });
// Confirmations count against the device as well as the user.
const DeviceHeader = z.object({ "x-device-token": z.string().regex(DEVICE_TOKEN) });

export type ConfirmGuard = Pick<RouteGuard, "requireUser">;

// POST /reports/{id}/confirm: signed in first (401), then the body and device token (400), then the reporter's answer.
export class ReportConfirmEndpoint {
  readonly #confirmer: ReportConfirmer;
  readonly #guard: ConfirmGuard;

  constructor(confirmer: ReportConfirmer, guard: ConfirmGuard) {
    this.#confirmer = confirmer;
    this.#guard = guard;
  }

  plugin(): FastifyPluginAsync {
    return async (app) => {
      app.post<{ Params: { id: string } }>("/reports/:id/confirm", async (request) => this.#confirm(request));
    };
  }

  async #confirm(request: FastifyRequest<{ Params: { id: string } }>): Promise<ReportStatusView> {
    const { userId } = await this.#guard.requireUser(request);
    const { sure } = ReportConfirmEndpoint.#parse(ConfirmBody, request.body, "confirm request");
    const deviceToken = ReportConfirmEndpoint.#parse(DeviceHeader, request.headers, "X-Device-Token")["x-device-token"];
    return this.#confirmer.confirm({ reportId: request.params.id, requester: { userId, deviceToken }, sure });
  }

  static #parse<S extends z.ZodType>(schema: S, value: unknown, what: string): z.output<S> {
    const result = schema.safeParse(value);
    if (!result.success) {
      throw new ValidationError(`${what}: ${z.prettifyError(result.error)}`);
    }
    return result.data;
  }
}
