export const LLM_TASKS = ["letters", "brands", "note_moderation", "note_analysis", "crawler"] as const;

export type LlmTask = (typeof LLM_TASKS)[number];

export const PROVIDER_NAMES = ["bedrock", "openai"] as const;

export type ProviderName = (typeof PROVIDER_NAMES)[number];
