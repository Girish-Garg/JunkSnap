import { describe, expect, it } from "vitest";
import { ConfigError } from "../../src/domain/errors.js";
import { LLM_TASKS } from "../../src/domain/llm/LlmTask.js";
import { PriceTable } from "../../src/domain/llm/PriceTable.js";
import { buildProviderRouter } from "../../src/handlers/LlmModule.js";
import { ProviderRouter } from "../../src/services/llm/ProviderRouter.js";
import { CoreSettings } from "../../src/settings/CoreSettings.js";
import { LlmSettings } from "../../src/settings/LlmSettings.js";
import { LogSink } from "../LogSink.js";
import { testLogger } from "./fakes.js";

const DEFAULT_ORDER = [
  ["bedrock", "global.anthropic.claude-sonnet-4-6"],
  ["bedrock", "in.anthropic.claude-haiku-4-5-20251001-v1:0"],
  ["bedrock", "apac.amazon.nova-pro-v1:0"],
  ["openai", "gpt-4.1-mini"],
];

function order(settings: LlmSettings, task: (typeof LLM_TASKS)[number]): string[][] {
  return (settings.tasks.get(task)?.choices() ?? []).map((choice) => [choice.provider, choice.model]);
}

describe("LlmSettings", () => {
  it("gives every task the default order and a stage secret id", () => {
    const settings = LlmSettings.fromEnv({}, "demo");
    expect([...settings.tasks.keys()]).toEqual(["letters", "brands", "note_moderation", "crawler"]);
    for (const task of LLM_TASKS) {
      expect(order(settings, task)).toEqual(DEFAULT_ORDER);
    }
    expect(settings.openAiSecretId).toBe("junksnap/demo/openai-api-key");
  });

  it("lets LLM_TASKS replace one task and OPENAI_SECRET_ID name the secret", () => {
    const env = {
      LLM_TASKS: JSON.stringify({ crawler: { provider: "openai", model: "gpt-4.1-mini", fallback: [{ provider: "bedrock", model: "apac.amazon.nova-lite-v1:0" }] } }),
      OPENAI_SECRET_ID: "junksnap/dev/other-key",
    };
    const settings = LlmSettings.fromEnv(env, "dev");
    expect(order(settings, "crawler")).toEqual([
      ["openai", "gpt-4.1-mini"],
      ["bedrock", "apac.amazon.nova-lite-v1:0"],
    ]);
    expect(order(settings, "letters")).toEqual(DEFAULT_ORDER);
    expect(settings.openAiSecretId).toBe("junksnap/dev/other-key");
  });

  it.each([
    ["not json", /not valid JSON/],
    ['{"judge": {"provider": "bedrock", "model": "m"}}', /LLM_TASKS/],
    ['{"letters": {"provider": "openrouter", "model": "m"}}', /LLM_TASKS/],
    ['{"letters": {"provider": "bedrock", "model": ""}}', /LLM_TASKS/],
  ])("rejects LLM_TASKS=%s", (value, message) => {
    expect(() => LlmSettings.fromEnv({ LLM_TASKS: value }, "dev")).toThrow(ConfigError);
    expect(() => LlmSettings.fromEnv({ LLM_TASKS: value }, "dev")).toThrow(message);
  });
});

describe("PriceTable", () => {
  const prices = new PriceTable();

  it.each([
    ["global.anthropic.claude-sonnet-4-6", 1000, 500, 0.0105],
    ["in.anthropic.claude-haiku-4-5-20251001-v1:0", 1000, 500, 0.00385],
    ["global.anthropic.claude-haiku-4-5-20251001-v1:0", 1000, 500, 0.0035],
    ["apac.amazon.nova-pro-v1:0", 2294, 149, 0.002312],
    ["gpt-4.1-mini", 40, 2, 0.000019],
  ])("prices %s at %i in and %i out as %f USD", (model, input, output, usd) => {
    expect(prices.costUsd(model, input, output)).toBe(usd);
  });

  it("returns null for a model without a listed price", () => {
    expect(prices.costUsd("some-new-model", 1000, 1000)).toBeNull();
  });
});

describe("buildProviderRouter", () => {
  it("builds the router from the environment without calling AWS", () => {
    const core = CoreSettings.fromEnv({ JUNKSNAP_STAGE: "dev" });
    expect(buildProviderRouter({ JUNKSNAP_STAGE: "dev" }, core, testLogger(new LogSink()))).toBeInstanceOf(ProviderRouter);
  });
});
