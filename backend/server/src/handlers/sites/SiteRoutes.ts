import type { FastifyPluginAsync, FastifyRequest } from "fastify";
import type { CleanupAccepted } from "../../domain/sites/Cleanup.js";
import type { SiteFeature, VoteResult } from "../../domain/sites/SiteTypes.js";
import type { CleanupIntake } from "../../services/sites/CleanupIntake.js";
import type { SiteFinder } from "../../services/sites/SiteFinder.js";
import type { VoteService } from "../../services/sites/VoteService.js";
import { SiteRequests } from "./SiteRequests.js";
import type { SiteUsers } from "./SiteUsers.js";

const ACCEPTED = 202;

export interface SiteRouteDeps {
  readonly finder: SiteFinder;
  readonly votes: VoteService;
  readonly cleanups: CleanupIntake;
  readonly users: SiteUsers;
}

interface FeatureCollection {
  readonly type: "FeatureCollection";
  readonly features: SiteFeature[];
}

// Browsing is open; voting and cleanups need the signed-in user first (401 before any other check).
export class SiteRoutes {
  readonly #deps: SiteRouteDeps;
  readonly #requests = new SiteRequests();

  constructor(deps: SiteRouteDeps) {
    this.#deps = deps;
  }

  plugin(): FastifyPluginAsync {
    return async (app) => {
      app.get("/sites", async (request) => this.#inBox(request.query));
      app.get("/sites/:id", async (request) => this.#deps.finder.byId(this.#requests.siteId(request.params)));
      app.post("/sites/:id/votes", async (request) => this.#vote(request));
      app.post("/sites/:id/cleanup", async (request, reply) => reply.status(ACCEPTED).send(await this.#cleanup(request)));
    };
  }

  async #inBox(query: unknown): Promise<FeatureCollection> {
    const features = await this.#deps.finder.inBox(this.#requests.bbox(query));
    return { type: "FeatureCollection", features };
  }

  async #vote(request: FastifyRequest): Promise<VoteResult> {
    const userId = await this.#deps.users.userIdOf(request);
    const siteId = this.#requests.siteId(request.params);
    return this.#deps.votes.cast(siteId, this.#requests.ballot(request.body, userId));
  }

  async #cleanup(request: FastifyRequest): Promise<CleanupAccepted> {
    const userId = await this.#deps.users.userIdOf(request);
    const siteId = this.#requests.siteId(request.params);
    return this.#deps.cleanups.submit(siteId, this.#requests.cleanup(request.body), userId);
  }
}
