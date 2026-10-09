import { BedrockRuntimeClient } from "@aws-sdk/client-bedrock-runtime";
import { SecretsManagerClient } from "@aws-sdk/client-secrets-manager";
import { BedrockProviderBuilder } from "../adapters/llm/BedrockProviderBuilder.js";
import { OpenAiProviderBuilder } from "../adapters/llm/OpenAiProviderBuilder.js";
import { SecretsManagerSecretReader } from "../adapters/SecretsManagerSecretReader.js";
import { PriceTable } from "../domain/llm/PriceTable.js";
import type { Logger } from "../ports/Logger.js";
import { ProviderFactory } from "../services/llm/ProviderFactory.js";
import { ProviderRouter, type RouterOptions } from "../services/llm/ProviderRouter.js";
import type { CoreSettings } from "../settings/CoreSettings.js";
import { LlmSettings } from "../settings/LlmSettings.js";
import type { Env } from "../settings/utils.js";

// Per attempt; the router's overall budget (45 s by default) caps the whole chain.
const CALL_TIMEOUT_MS = 25_000;
const SECRET_TIMEOUT_MS = 5_000;

// Call once per process from a composition root; inside a route plugin pass `app.log`.
export function buildProviderRouter(env: Env, core: CoreSettings, logger: Logger, options: RouterOptions = {}): ProviderRouter {
  const settings = LlmSettings.fromEnv(env, core.stage);
  const prices = new PriceTable();
  const bedrock = new BedrockRuntimeClient({ region: core.awsRegion });
  const secretsClient = new SecretsManagerClient({ region: core.awsRegion, requestHandler: { requestTimeout: SECRET_TIMEOUT_MS } });
  const factory = new ProviderFactory([
    new BedrockProviderBuilder(bedrock, prices, CALL_TIMEOUT_MS),
    new OpenAiProviderBuilder({
      fetch: globalThis.fetch,
      secrets: new SecretsManagerSecretReader(secretsClient),
      secretId: settings.openAiSecretId,
      prices,
      timeoutMs: CALL_TIMEOUT_MS,
    }),
  ]);
  return new ProviderRouter(settings.tasks, factory, logger, options);
}
