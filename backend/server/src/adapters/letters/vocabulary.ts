import { z } from "zod";
import { letterDraftSchema, siteSchema } from "../../contracts/index.gen.js";
import type { Channel, ReportType } from "../../domain/letters/types.js";

const CHANNELS: readonly string[] = letterDraftSchema.properties.channel.enum;
const REPORT_TYPES: readonly string[] = siteSchema.properties.properties.properties.report_type.enum;

export const channelSchema = z.custom<Channel>(
  (value) => typeof value === "string" && CHANNELS.includes(value),
  { message: `channel must be one of ${CHANNELS.join(", ")}` },
);

export const reportTypeSchema = z.custom<ReportType>(
  (value) => typeof value === "string" && REPORT_TYPES.includes(value),
  { message: `report type must be one of ${REPORT_TYPES.join(", ")}` },
);
