import { AreaListSettings } from "../src/settings/AreaListSettings.js";
import { QueueSettings } from "../src/settings/QueueSettings.js";
import { ScanLimitSettings } from "../src/settings/ScanLimitSettings.js";
import { ScoreSettings } from "../src/settings/ScoreSettings.js";
import { SiteRuleSettings } from "../src/settings/SiteRuleSettings.js";
import { TimeoutSettings } from "../src/settings/TimeoutSettings.js";

// Every tunable at its default, as a deployment that sets none of the variables sees it.
export const RULES = SiteRuleSettings.fromEnv({});
export const SCORES = ScoreSettings.fromEnv({});
export const QUEUE = QueueSettings.fromEnv({});
export const AREA_LIST = AreaListSettings.fromEnv({});
export const SCAN = ScanLimitSettings.fromEnv({});
export const TIMEOUTS = TimeoutSettings.fromEnv({});
