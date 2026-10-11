import { BedrockRuntimeClient } from "@aws-sdk/client-bedrock-runtime";
import { SecretsManagerClient } from "@aws-sdk/client-secrets-manager";
import { BedrockProviderBuilder } from "../adapters/llm/BedrockProviderBuilder.js";
import { OpenAiProviderBuilder } from "../adapters/llm/OpenAiProviderBuilder.js";
import { SecretsManagerSecretReader } from "../adapters/SecretsManagerSecretReader.js";
import { PriceTable } from "../domain/llm/PriceTable.js";
import type { Logger } from "../ports/Logger.js";
import { ProviderFactory } from "../services/llm/ProviderFactory.js";
import { ProviderRouter } from "../services/llm/ProviderRouter.js";
import type { CoreSettings } from "../settings/CoreSettings.js";
import { LlmSettings } from "../settings/LlmSettings.js";
import { TimeoutSettings } from "../settings/TimeoutSettings.js";
import type { Env } from "../settings/utils.js";
import { awsClientConfig } from "./utils.js";

// Call once per process from a composition root; inside a route plugin pass `app.log`.
// Each attempt gets LLM_CALL_TIMEOUT_MS; LLM_BUDGET_MS caps the whole chain.
export function buildProviderRouter(env: Env, core: CoreSettings, logger: Logger): ProviderRouter {
  const settings = LlmSettings.fromEnv(env, core.stage);
  const timeouts = TimeoutSettings.fromEnv(env);
  const prices = new PriceTable();
  const bedrock = new BedrockRuntimeClient({ region: core.awsRegion });
  const secretsClient = new SecretsManagerClient(awsClientConfig(core.awsRegion, timeouts.aws.secrets));
  const factory = new ProviderFactory([
    new BedrockProviderBuilder(bedrock, prices, timeouts.llm.callMs),
    new OpenAiProviderBuilder({
      fetch: globalThis.fetch,
      secrets: new SecretsManagerSecretReader(secretsClient),
      secretId: settings.openAiSecretId,
      prices,
      timeoutMs: timeouts.llm.callMs,
    }),
  ]);
  return new ProviderRouter(settings.tasks, factory, logger, { budgetMs: timeouts.llm.budgetMs });
}
