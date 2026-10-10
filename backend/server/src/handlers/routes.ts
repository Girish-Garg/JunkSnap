import { buildAreaCrawlRoutes } from "./areaCrawlRoutes.js";
import { buildAreaScoresRoutes } from "./areaScoresRoutes.js";
import { buildLettersRoutes } from "./lettersRoutes.js";
import { buildNotesRoutes } from "./notesRoutes.js";
import { buildReportRoutes } from "./reportRoutes.js";
import type { RouteBuilder } from "./RouteBuilder.js";
import { buildScanRoutes } from "./scanRoutes.js";
import { buildShareRoutes } from "./shareRoutes.js";
import { buildSitesRoutes } from "./sitesRoutes.js";

// A task adds handlers/<topic>Routes.ts, then one import and one entry here.
export const ROUTE_BUILDERS: readonly RouteBuilder[] = [
  // one builder per line
  buildSitesRoutes,
  buildAreaScoresRoutes,
  buildAreaCrawlRoutes,
  buildLettersRoutes,
  buildNotesRoutes,
  buildReportRoutes,
  buildScanRoutes,
  buildShareRoutes,
];
