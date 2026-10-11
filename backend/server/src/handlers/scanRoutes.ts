import type { FastifyPluginAsync } from "fastify";
import { ulid } from "ulid";
import { ScanFindings } from "../domain/scout/ScanFindings.js";
import { PublicMedia } from "../domain/sites/PublicMedia.js";
import { ScanIntake } from "../services/ScanIntake.js";
import { ScanSessionRules } from "../services/ScanSessionRules.js";
import { ScanUploadPresigner } from "../services/ScanUploadPresigner.js";
import { ScanLimitSettings } from "../settings/ScanLimitSettings.js";
import { ScanSettings } from "../settings/ScanSettings.js";
import { RouteGuard } from "./auth/RouteGuard.js";
import type { RouteContext } from "./RouteBuilder.js";
import { ScanAdapterFactory } from "./ScanAdapterFactory.js";
import { ScanRequestParser } from "./ScanRequestParser.js";

export interface ScanRouteServices {
  readonly presigner: ScanUploadPresigner;
  readonly intake: ScanIntake;
  readonly guard: RouteGuard;
}

// Every scan route needs sign-in. The phone PUTs the video straight to S3, so it never passes through the api.
export function scanRoutes({ presigner, intake, guard }: ScanRouteServices): FastifyPluginAsync {
  const parse = new ScanRequestParser();
  return async (app) => {
    app.post("/scans/presign", async (request) => {
      await guard.requireUser(request);
      return presigner.presign(parse.presign(request.body));
    });
    app.post("/scans", async (request, reply) => {
      const user = await guard.requireUser(request);
      const accepted = await intake.submit(parse.session(request.body), user.userId);
      return reply.status(202).send(accepted);
    });
    app.get<{ Params: { id: string } }>("/scans/:id", async (request) => {
      const user = await guard.requireUser(request);
      return intake.status(request.params.id, user.userId);
    });
  };
}

// Settings load when the api registers the plugin, after its CORS check, so startup still fails fast in order.
export function buildScanRoutes({ core, env }: RouteContext): FastifyPluginAsync {
  return async (app) => {
    const settings = ScanSettings.fromEnv(env);
    const limits = ScanLimitSettings.fromEnv(env);
    const guard = RouteGuard.fromEnv(env);
    const adapters = new ScanAdapterFactory(settings, core.awsRegion);
    const now = (): Date => new Date();
    const newScanId = (): string => `scn_${ulid().toLowerCase()}`;
    const presigner = new ScanUploadPresigner(adapters.uploadSigner(), {
      ttlSeconds: settings.presignTtlSeconds,
      now,
      newScanId,
      limits: limits.video,
    });
    const findings = new ScanFindings(new PublicMedia(settings.publicBaseUrl));
    const reads = { outcomes: adapters.frameOutcomes(), findings };
    const intake = new ScanIntake({ scans: adapters.scans(), queue: adapters.queue(), rules: new ScanSessionRules(limits.gps.minFixesPerSecond), ...reads, now });
    await app.register(scanRoutes({ presigner, intake, guard }));
  };
}
