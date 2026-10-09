import { InternalDataError } from "../errors.js";
import type { LetterSite } from "./LetterSite.js";
import type { SitePlace } from "./SitePlace.js";
import type { Channel, Recipient, ReportType } from "./types.js";

const PLACEHOLDER = /\{[a-z_.]+\}/g;

export interface ChannelRouteProps {
  readonly channel: Channel;
  readonly reportTypes: readonly ReportType[];
  readonly orBurning: boolean;
  // Null means every state.
  readonly states: readonly string[] | null;
  readonly requiresLocalBody: boolean;
  readonly to: Recipient;
  readonly stateBodies: Readonly<Record<string, string>>;
  readonly filingUrl: string | null;
}

// One channel from data/rules/routing.json.
export class ChannelRoute {
  readonly channel: Channel;
  readonly requiresLocalBody: boolean;
  readonly filingUrl: string | null;
  readonly #props: ChannelRouteProps;

  constructor(props: ChannelRouteProps) {
    this.channel = props.channel;
    this.requiresLocalBody = props.requiresLocalBody;
    this.filingUrl = props.filingUrl;
    this.#props = props;
  }

  appliesTo(site: LetterSite): boolean {
    const { reportTypes, orBurning, states } = this.#props;
    const situationFits = reportTypes.includes(site.reportType) || (orBurning && site.burning);
    return situationFits && (states === null || states.includes(site.place.state));
  }

  recipient(place: SitePlace): Recipient {
    const values = place.placeholders();
    const body = this.#props.stateBodies[place.state] ?? this.#props.to.body;
    return { office: ChannelRoute.#fill(this.#props.to.office, values), body: ChannelRoute.#fill(body, values) };
  }

  static #fill(template: string, values: ReadonlyMap<string, string>): string {
    return template.replace(PLACEHOLDER, (key) => {
      const value = values.get(key);
      if (value === undefined) {
        throw new InternalDataError(`routing.json placeholder ${key} has no value for this site`);
      }
      return value;
    });
  }
}
