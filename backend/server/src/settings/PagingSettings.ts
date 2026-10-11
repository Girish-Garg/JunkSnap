import { z } from "zod";
import { parseEnv, type Env } from "./utils.js";

const pages = (max: number, fallback: number) => z.coerce.number().int().min(1).max(max).default(fallback);

const PagingEnv = z.object({
  AREA_LETTER_MAX_PAGES: pages(1_000, 20),
  NOTES_MAX_PAGES: pages(1_000, 5),
  MY_REPORTS_MAX_ROUNDS: pages(1_000, 10),
  // DynamoDB BatchGetItem takes at most 100 keys.
  BATCH_GET_SIZE: pages(100, 100),
  MAP_MAX_SITES: pages(10_000, 500),
  BBOX_MAX_DEGREES: z.coerce.number().gt(0).max(10).default(1),
});

// Caps on how much one request reads, so a large table never turns one answer into an unbounded scan.
export class PagingSettings {
  // Scan pages an area letter reads from the sites table before it gives up.
  readonly areaLetterMaxPages: number;
  // Query pages of notes, report notes or photo report texts read for one site's community analysis.
  readonly notesMaxPages: number;
  // by-user queries GET /me/reports runs to fill one page.
  readonly myReportsMaxRounds: number;
  readonly batchGetSize: number;
  // Sites GET /sites?bbox returns at most, newest first.
  readonly mapMaxSites: number;
  // GET /sites?bbox covers at most this many degrees of longitude and of latitude, else 400 bbox_too_large.
  readonly bboxMaxDegrees: number;

  private constructor(values: z.output<typeof PagingEnv>) {
    this.areaLetterMaxPages = values.AREA_LETTER_MAX_PAGES;
    this.notesMaxPages = values.NOTES_MAX_PAGES;
    this.myReportsMaxRounds = values.MY_REPORTS_MAX_ROUNDS;
    this.batchGetSize = values.BATCH_GET_SIZE;
    this.mapMaxSites = values.MAP_MAX_SITES;
    this.bboxMaxDegrees = values.BBOX_MAX_DEGREES;
    Object.freeze(this);
  }

  static fromEnv(env: Env): PagingSettings {
    return new PagingSettings(parseEnv(PagingEnv, env));
  }
}
