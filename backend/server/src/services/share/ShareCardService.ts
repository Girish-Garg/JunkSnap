import { NotFoundError, ValidationError } from "../../domain/errors.js";
import type { AreaCardWriter } from "../../domain/share/AreaCardWriter.js";
import type { ShareCard } from "../../domain/share/ShareCard.js";
import type { SiteCardWriter } from "../../domain/share/SiteCardWriter.js";
import type { ShareAreaSource, ShareSiteSource } from "../../ports/share/ShareSources.js";

export interface ShareCardDeps {
  readonly sites: ShareSiteSource;
  readonly areas: ShareAreaSource;
  readonly siteCards: SiteCardWriter;
  readonly areaCards: AreaCardWriter;
}

// One card per shared link; an unknown or malformed id gets the generic card, any other failure stays a 500.
export class ShareCardService {
  readonly #deps: ShareCardDeps;

  constructor(deps: ShareCardDeps) {
    this.#deps = deps;
  }

  async site(siteId: string): Promise<ShareCard> {
    const { sites, siteCards } = this.#deps;
    return ShareCardService.#orUnknown(
      async () => siteCards.card(await sites.byId(siteId)),
      () => siteCards.unknown(siteId),
    );
  }

  async area(kind: string, areaId: string): Promise<ShareCard> {
    const { areas, areaCards } = this.#deps;
    return ShareCardService.#orUnknown(
      async () => areaCards.card(await areas.find(kind, areaId)),
      () => areaCards.unknown(kind, areaId),
    );
  }

  static async #orUnknown(read: () => Promise<ShareCard>, unknown: () => ShareCard): Promise<ShareCard> {
    try {
      return await read();
    } catch (error) {
      if (error instanceof NotFoundError || error instanceof ValidationError) {
        return unknown();
      }
      throw error;
    }
  }
}
