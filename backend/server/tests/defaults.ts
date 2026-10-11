import { AreaListSettings } from "../src/settings/AreaListSettings.js";
import { QueueSettings } from "../src/settings/QueueSettings.js";
import { ScoreSettings } from "../src/settings/ScoreSettings.js";
import { SiteRuleSettings } from "../src/settings/SiteRuleSettings.js";

// Every tunable at its default, as a deployment that sets none of the variables sees it.
export const RULES = SiteRuleSettings.fromEnv({});
export const SCORES = ScoreSettings.fromEnv({});
export const QUEUE = QueueSettings.fromEnv({});
export const AREA_LIST = AreaListSettings.fromEnv({});
