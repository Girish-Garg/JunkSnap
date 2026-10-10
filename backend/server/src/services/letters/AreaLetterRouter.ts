import type { AreaKey, AreaKind } from "../../domain/AreaKey.js";
import { NoLocalBodyError } from "../../domain/letters/errors.js";
import type { LetterSite } from "../../domain/letters/LetterSite.js";
import type { AreaAddressees, CcLine, Channel, Recipient } from "../../domain/letters/types.js";

const SEAT_OFFICE: Readonly<Record<AreaKind, CcLine["office"] | null>> = {
  ward: "councillor",
  assembly: "mla",
  loksabha: "mp",
  district: null,
};

// The District Collector reviews local bodies (SWM Rules 2026 rule 37), so wider areas go to the Collector too.
const COLLECTOR_KINDS: ReadonlySet<AreaKind> = new Set(["loksabha", "district"]);

export class AreaLetterRouter {
  route(area: AreaKey, sites: readonly LetterSite[]): AreaAddressees {
    const collectors = COLLECTOR_KINDS.has(area.kind) ? AreaLetterRouter.#collectors(sites) : [];
    const to = AreaLetterRouter.#unique([...collectors, ...AreaLetterRouter.#heads(sites)]);
    if (to.length === 0) {
      throw new NoLocalBodyError("No local body is known for the sites in this area yet, so the letter has no addressee.");
    }
    return { to, cc: AreaLetterRouter.#seat(area, sites) };
  }

  // Rules are picked for the offices the letter goes to, Collector rules first.
  channels(area: AreaKey): readonly Channel[] {
    return COLLECTOR_KINDS.has(area.kind) ? ["district_collector", "local_body"] : ["local_body"];
  }

  static #heads(sites: readonly LetterSite[]): Recipient[] {
    return sites.flatMap(({ place }) =>
      place.localBody === null ? [] : [{ office: place.localBody.headOffice, body: place.localBody.name }],
    );
  }

  static #collectors(sites: readonly LetterSite[]): Recipient[] {
    return sites.map(({ place }) => ({ office: "District Collector", body: `${place.district.name} district, ${place.state}` }));
  }

  // Only the area's own seat, and only when a site lists its representative (never an outdated MP seat).
  static #seat(area: AreaKey, sites: readonly LetterSite[]): CcLine[] {
    const office = SEAT_OFFICE[area.kind];
    const line = sites
      .flatMap((site) => site.place.ccLines())
      .find((candidate) => candidate.office === office && candidate.seat.id === area.id);
    return line === undefined ? [] : [line];
  }

  static #unique(recipients: readonly Recipient[]): Recipient[] {
    const seen = new Map(recipients.map((recipient) => [`${recipient.office}|${recipient.body}`, recipient]));
    return [...seen.values()];
  }
}
