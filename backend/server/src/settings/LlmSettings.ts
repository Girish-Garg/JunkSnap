import { z } from "zod";
import { ConfigError } from "../domain/errors.js";
import { LLM_TASKS, PROVIDER_NAMES, type LlmTask } from "../domain/llm/LlmTask.js";
import { ModelChoice } from "../domain/llm/ModelChoice.js";
import { TaskConfig } from "../domain/llm/TaskConfig.js";
import type { Stage } from "./CoreSettings.js";
import { parseEnv, type Env } from "./utils.js";

// Decision 20261010-0133: Bedrock first, OpenAI last.
export const DEFAULT_TASK_CONFIG = new TaskConfig("bedrock", "global.anthropic.claude-sonnet-4-6", [
  new ModelChoice("bedrock", "in.anthropic.claude-haiku-4-5-20251001-v1:0"),
  new ModelChoice("bedrock", "apac.amazon.nova-pro-v1:0"),
  new ModelChoice("openai", "gpt-4.1-mini"),
]);

const Choice = z.strictObject({ provider: z.enum(PROVIDER_NAMES), model: z.string().min(1) });
const Task = z.strictObject({ ...Choice.shape, fallback: z.array(Choice).default([]) });
const Tasks = z.partialRecord(z.enum(LLM_TASKS), Task);

const LlmEnv = z.object({
  LLM_TASKS: z.string().default(""),
  OPENAI_SECRET_ID: z.string().default(""),
});

export class LlmSettings {
  readonly tasks: ReadonlyMap<LlmTask, TaskConfig>;
  readonly openAiSecretId: string;

  private constructor(tasks: ReadonlyMap<LlmTask, TaskConfig>, openAiSecretId: string) {
    this.tasks = tasks;
    this.openAiSecretId = openAiSecretId;
  }

  static fromEnv(env: Env, stage: Stage): LlmSettings {
    const values = parseEnv(LlmEnv, env);
    const secretId = values.OPENAI_SECRET_ID.trim() || `junksnap/${stage}/openai-api-key`;
    return new LlmSettings(LlmSettings.#tasks(values.LLM_TASKS), secretId);
  }

  // Every task gets the default order unless LLM_TASKS replaces it.
  static #tasks(text: string): ReadonlyMap<LlmTask, TaskConfig> {
    const result = Tasks.safeParse(LlmSettings.#json(text));
    if (!result.success) {
      throw new ConfigError(`LLM_TASKS: ${z.prettifyError(result.error)}`);
    }
    const overrides = result.data;
    return new Map(
      LLM_TASKS.map((task) => {
        const config = overrides[task];
        const fallback = config?.fallback.map((item) => new ModelChoice(item.provider, item.model));
        return [task, config ? new TaskConfig(config.provider, config.model, fallback) : DEFAULT_TASK_CONFIG];
      }),
    );
  }

  static #json(text: string): unknown {
    if (text.trim() === "") {
      return {};
    }
    try {
      return JSON.parse(text) as unknown;
    } catch (error) {
      throw new ConfigError("LLM_TASKS is not valid JSON", { cause: error });
    }
  }
}
