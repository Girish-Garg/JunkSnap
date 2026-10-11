import { AreaListSettings } from "../src/settings/AreaListSettings.js";
import { CacheSettings } from "../src/settings/CacheSettings.js";
import { ModelLimitSettings } from "../src/settings/ModelLimitSettings.js";
import { ModerationRuleSettings } from "../src/settings/ModerationRuleSettings.js";
import { PagingSettings } from "../src/settings/PagingSettings.js";
import { QueueSettings } from "../src/settings/QueueSettings.js";
import { RetrySettings } from "../src/settings/RetrySettings.js";
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
export const RETRY = RetrySettings.fromEnv({});
export const PAGING = PagingSettings.fromEnv({});
export const CACHE = CacheSettings.fromEnv({});
export const MODELS = ModelLimitSettings.fromEnv({});
export const MODERATION = ModerationRuleSettings.fromEnv({});
