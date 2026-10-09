import { describe, expect, it } from "vitest";
import { ExternalServiceError } from "../../src/domain/errors.js";
import { LlmRequest } from "../../src/domain/llm/LlmRequest.js";
import type { ModelChoice } from "../../src/domain/llm/ModelChoice.js";
import { buildProviderRouter } from "../../src/handlers/LlmModule.js";
import { CoreSettings } from "../../src/settings/CoreSettings.js";
import { DEFAULT_TASK_CONFIG } from "../../src/settings/LlmSettings.js";
import { LogSink } from "../LogSink.js";
import { llmLines, testLogger } from "./fakes.js";

const PING = new LlmRequest({ task: "letters", system: "Answer with exactly one word.", userText: "Ping", maxTokens: 10 });
const CORE = CoreSettings.fromEnv({ JUNKSNAP_STAGE: "dev" });

async function askOnly(choice: ModelChoice): Promise<Record<string, unknown>> {
  const sink = new LogSink();
  const env = { JUNKSNAP_STAGE: "dev", LLM_TASKS: JSON.stringify({ letters: { provider: choice.provider, model: choice.model } }) };
  try {
    const response = await buildProviderRouter(env, CORE, testLogger(sink)).complete(PING);
    return { ...llmLines(sink).at(-1), answer: response.text.trim() };
  } catch (error) {
    if (!(error instanceof ExternalServiceError)) {
      throw error;
    }
    return { ...llmLines(sink).at(-1) };
  }
}

// Real calls on the junksnap account: RUN_AWS_TESTS=1 AWS_PROFILE=junksnap npx vitest run tests/llm/aws.test.ts
describe.runIf(process.env.RUN_AWS_TESTS === "1")("LLM providers on AWS", () => {
  it("calls each provider of the default order once and the full chain answers", async () => {
    for (const choice of DEFAULT_TASK_CONFIG.choices()) {
      const line = await askOnly(choice);
      const fields = ["provider", "model", "version", "outcome", "latency_ms", "input_tokens", "output_tokens", "cost_usd", "answer", "reason"];
      console.log(JSON.stringify(Object.fromEntries(fields.filter((key) => key in line).map((key) => [key, line[key]]))));
    }
    const sink = new LogSink();
    const response = await buildProviderRouter({ JUNKSNAP_STAGE: "dev" }, CORE, testLogger(sink)).complete(PING);
    console.log(`default chain answered with ${response.provider} ${response.model}: ${response.text.trim()}`);
    expect(response.text.trim()).not.toBe("");
  }, 120_000);
});
