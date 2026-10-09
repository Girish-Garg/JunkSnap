import type { FastifyPluginAsync } from "fastify";
import type { SiteFeature } from "../../domain/sites/SiteTypes.js";
import type { CleanupIntake } from "../../services/sites/CleanupIntake.js";
import type { SiteFinder } from "../../services/sites/SiteFinder.js";
import type { VoteService } from "../../services/sites/VoteService.js";
import { SiteRequests } from "./SiteRequests.js";

const ACCEPTED = 202;

export interface SiteRouteServices {
  readonly finder: SiteFinder;
  readonly votes: VoteService;
  readonly cleanups: CleanupIntake;
}

interface FeatureCollection {
  readonly type: "FeatureCollection";
  readonly features: SiteFeature[];
}

export class SiteRoutes {
  readonly #services: SiteRouteServices;
  readonly #requests = new SiteRequests();

  constructor(services: SiteRouteServices) {
    this.#services = services;
  }

  plugin(): FastifyPluginAsync {
    const { finder, votes, cleanups } = this.#services;
    const requests = this.#requests;
    return async (app) => {
      app.get("/sites", async (request) => this.#inBox(request.query));
      app.get("/sites/:id", async (request) => finder.byId(requests.siteId(request.params)));
      // requireUser (server-34-auth) plugs in here as a preHandler on the two POST routes.
      app.post("/sites/:id/votes", async (request) =>
        votes.cast(requests.siteId(request.params), requests.ballot(request.body)),
      );
      app.post("/sites/:id/cleanup", async (request, reply) => {
        const accepted = await cleanups.submit(requests.siteId(request.params), requests.cleanup(request.body));
        return reply.status(ACCEPTED).send(accepted);
      });
    };
  }

  async #inBox(query: unknown): Promise<FeatureCollection> {
    const features = await this.#services.finder.inBox(this.#requests.bbox(query));
    return { type: "FeatureCollection", features };
  }
}
