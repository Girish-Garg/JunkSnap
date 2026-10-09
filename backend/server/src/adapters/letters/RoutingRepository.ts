import { z } from "zod";
import { ChannelRoute } from "../../domain/letters/ChannelRoute.js";
import { RoutingTable } from "../../domain/letters/RoutingTable.js";
import type { AssetFiles } from "./AssetFiles.js";
import { channelSchema, reportTypeSchema } from "./vocabulary.js";

const ChannelEntry = z.object({
  channel: channelSchema,
  report_types: z.array(reportTypeSchema),
  or_burning: z.boolean(),
  states: z.array(z.string()).nullable(),
  requires_local_body: z.boolean(),
  to: z.object({ office: z.string().min(1), body: z.string().min(1) }),
  state_bodies: z.record(z.string(), z.string()),
  filing_url: z.url().nullable(),
});

const RoutingFile = z.object({
  cc: z.object({ marking: z.literal("for attention") }),
  channels: z.array(ChannelEntry).min(1),
});

type ChannelEntry = z.output<typeof ChannelEntry>;

export class RoutingRepository {
  readonly #files: AssetFiles;

  constructor(files: AssetFiles) {
    this.#files = files;
  }

  async load(): Promise<RoutingTable> {
    const routing = await this.#files.json("routing.json", RoutingFile);
    return new RoutingTable(routing.channels.map(RoutingRepository.#route));
  }

  static #route(entry: ChannelEntry): ChannelRoute {
    return new ChannelRoute({
      channel: entry.channel,
      reportTypes: entry.report_types,
      orBurning: entry.or_burning,
      states: entry.states,
      requiresLocalBody: entry.requires_local_body,
      to: entry.to,
      stateBodies: entry.state_bodies,
      filingUrl: entry.filing_url,
    });
  }
}
