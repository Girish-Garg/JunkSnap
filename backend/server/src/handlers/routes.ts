import { buildAreaScoresRoutes } from "./areaScoresRoutes.js";
import { buildLettersRoutes } from "./lettersRoutes.js";
import type { RouteBuilder } from "./RouteBuilder.js";
import { buildSitesRoutes } from "./sitesRoutes.js";

// A task adds handlers/<topic>Routes.ts, then one import and one entry here.
export const ROUTE_BUILDERS: readonly RouteBuilder[] = [
  // one builder per line
  buildSitesRoutes,
  buildAreaScoresRoutes,
  buildLettersRoutes,
];
