import { InternalDataError } from "../errors.js";
import type { ChannelRoute } from "./ChannelRoute.js";
import type { Channel } from "./types.js";

export class RoutingTable {
  readonly #routes: ReadonlyMap<Channel, ChannelRoute>;

  constructor(routes: readonly ChannelRoute[]) {
    this.#routes = new Map(routes.map((route) => [route.channel, route]));
  }

  route(channel: Channel): ChannelRoute {
    const route = this.#routes.get(channel);
    if (route === undefined) {
      throw new InternalDataError(`routing.json has no ${channel} channel`);
    }
    return route;
  }
}
