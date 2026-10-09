import type { FastifyPluginAsync } from "fastify";
import { ulid } from "ulid";
import { ScanIntake } from "../services/ScanIntake.js";
import { ScanSessionRules } from "../services/ScanSessionRules.js";
import { ScanUploadPresigner } from "../services/ScanUploadPresigner.js";
import { ScanSettings } from "../settings/ScanSettings.js";
import type { RouteContext } from "./RouteBuilder.js";
import { ScanAdapterFactory } from "./ScanAdapterFactory.js";
import { ScanRequestParser } from "./ScanRequestParser.js";

export interface ScanRouteServices {
  readonly presigner: ScanUploadPresigner;
  readonly intake: ScanIntake;
}

// The phone PUTs the video straight to S3, so it never passes through the api.
export function scanRoutes({ presigner, intake }: ScanRouteServices): FastifyPluginAsync {
  const parse = new ScanRequestParser();
  return async (app) => {
    app.post("/scans/presign", async (request) => presigner.presign(parse.presign(request.body)));
    app.post("/scans", async (request, reply) => {
      const accepted = await intake.submit(parse.session(request.body));
      return reply.status(202).send(accepted);
    });
    app.get<{ Params: { id: string } }>("/scans/:id", async (request) =>
      intake.status(request.params.id, parse.deviceToken(request.headers)),
    );
  };
}

// Settings load when the api registers the plugin, after its CORS check, so startup still fails fast in order.
export function buildScanRoutes({ core, env }: RouteContext): FastifyPluginAsync {
  return async (app) => {
    const settings = ScanSettings.fromEnv(env);
    const adapters = new ScanAdapterFactory(settings, core.awsRegion);
    const now = (): Date => new Date();
    const newScanId = (): string => `scn_${ulid().toLowerCase()}`;
    const presigner = new ScanUploadPresigner(adapters.uploadSigner(), {
      ttlSeconds: settings.presignTtlSeconds,
      now,
      newScanId,
    });
    const intake = new ScanIntake({ scans: adapters.scans(), queue: adapters.queue(), rules: new ScanSessionRules(), now });
    await app.register(scanRoutes({ presigner, intake }));
  };
}
