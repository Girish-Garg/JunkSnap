import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from "fastify";
import type { ShareCard } from "../../domain/share/ShareCard.js";
import type { ShareCardService } from "../../services/share/ShareCardService.js";
import { CacheSettings } from "../../settings/CacheSettings.js";
import type { AppHandoff } from "./AppHandoff.js";
import { ShareHtml } from "./ShareHtml.js";

interface SiteParams {
  readonly id: string;
}

interface AreaParams {
  readonly kind: string;
  readonly id: string;
}


// GET /share/sites/{id} and GET /share/areas/{kind}/{id}: link previews (contracts/README.md, Routes).
export class ShareRoutes {
  readonly #cards: ShareCardService;
  readonly #handoff: AppHandoff | null;
  readonly #html = new ShareHtml();
  readonly #cache: string;

  // Without a handoff every reader goes straight to the web app. Crawlers re-read a card at most every
  // SHARE_CACHE_MAX_AGE_SECONDS; nothing personal is on it.
  constructor(cards: ShareCardService, handoff: AppHandoff | null = null, maxAgeSeconds = CacheSettings.fromEnv({}).shareMaxAgeSeconds) {
    this.#cards = cards;
    this.#handoff = handoff;
    this.#cache = CacheSettings.publicFor(maxAgeSeconds);
  }

  plugin(): FastifyPluginAsync {
    return async (app) => {
      app.get<{ Params: SiteParams }>("/share/sites/:id", async (request, reply) =>
        this.#send(request, reply, await this.#cards.site(request.params.id)),
      );
      app.get<{ Params: AreaParams }>("/share/areas/:kind/:id", async (request, reply) =>
        this.#send(request, reply, await this.#cards.area(request.params.kind, request.params.id)),
      );
    };
  }

  #send(request: FastifyRequest, reply: FastifyReply, card: ShareCard): FastifyReply {
    const redirect = this.#handoff?.redirect(card.appUrl, request.headers["user-agent"]);
    const page = this.#html.render(card, redirect);
    const policy = `default-src 'none'; img-src https:; script-src 'sha256-${page.scriptHash}'; base-uri 'none'; form-action 'none'`;
    return reply
      .status(card.status)
      .header("content-type", "text/html; charset=utf-8")
      .header("cache-control", this.#cache)
      // The script differs for Android browsers (AppHandoff).
      .header("vary", "User-Agent")
      .header("content-security-policy", policy)
      .header("x-content-type-options", "nosniff")
      .header("referrer-policy", "no-referrer")
      .send(page.html);
  }
}
