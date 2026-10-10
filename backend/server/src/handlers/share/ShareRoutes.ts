import type { FastifyPluginAsync, FastifyReply } from "fastify";
import type { ShareCard } from "../../domain/share/ShareCard.js";
import type { ShareCardService } from "../../services/share/ShareCardService.js";
import { ShareHtml } from "./ShareHtml.js";

interface SiteParams {
  readonly id: string;
}

interface AreaParams {
  readonly kind: string;
  readonly id: string;
}

// Crawlers re-read a card at most every 5 minutes; nothing personal is on it.
const CACHE = "public, max-age=300";

// GET /share/sites/{id} and GET /share/areas/{kind}/{id}: link previews (contracts/README.md, Routes).
export class ShareRoutes {
  readonly #cards: ShareCardService;
  readonly #html = new ShareHtml();

  constructor(cards: ShareCardService) {
    this.#cards = cards;
  }

  plugin(): FastifyPluginAsync {
    return async (app) => {
      app.get<{ Params: SiteParams }>("/share/sites/:id", async (request, reply) =>
        this.#send(reply, await this.#cards.site(request.params.id)),
      );
      app.get<{ Params: AreaParams }>("/share/areas/:kind/:id", async (request, reply) =>
        this.#send(reply, await this.#cards.area(request.params.kind, request.params.id)),
      );
    };
  }

  #send(reply: FastifyReply, card: ShareCard): FastifyReply {
    const page = this.#html.render(card);
    const policy = `default-src 'none'; img-src https:; script-src 'sha256-${page.scriptHash}'; base-uri 'none'; form-action 'none'`;
    return reply
      .status(card.status)
      .header("content-type", "text/html; charset=utf-8")
      .header("cache-control", CACHE)
      .header("content-security-policy", policy)
      .header("x-content-type-options", "nosniff")
      .header("referrer-policy", "no-referrer")
      .send(page.html);
  }
}
