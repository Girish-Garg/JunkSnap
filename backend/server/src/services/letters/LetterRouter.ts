import { ChannelNotApplicableError, NoLocalBodyError } from "../../domain/letters/errors.js";
import type { LetterSite } from "../../domain/letters/LetterSite.js";
import type { RoutingTable } from "../../domain/letters/RoutingTable.js";
import type { Addressees, Channel } from "../../domain/letters/types.js";

export class LetterRouter {
  readonly #table: RoutingTable;

  constructor(table: RoutingTable) {
    this.#table = table;
  }

  route(channel: Channel, site: LetterSite): Addressees {
    const route = this.#table.route(channel);
    if (!route.appliesTo(site)) {
      const where = `${site.reportType} site in ${site.place.state}`;
      throw new ChannelNotApplicableError(`A ${channel} letter does not fit a ${where}.`);
    }
    if (route.requiresLocalBody && site.place.localBody === null) {
      throw new NoLocalBodyError("No local body is known for this site yet, so the letter has no addressee.");
    }
    return {
      channel,
      to: route.recipient(site.place),
      cc: site.place.ccLines(),
      filingUrl: route.filingUrl,
    };
  }
}
