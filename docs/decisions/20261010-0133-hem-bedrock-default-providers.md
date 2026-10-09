---
status: proposed
superseded_by:
area: agent
by: hem
date: 2026-10-10T01:33+05:30
---
# Bedrock is the default model provider; OpenAI and OpenRouter are fallbacks

Context: measured on 10 Oct at 01:15 IST with one-word test prompts from ap-south-1. Available: `global.anthropic.claude-sonnet-4-6`, `global.anthropic.claude-sonnet-4-5-20250929-v1:0`, `in.anthropic.claude-haiku-4-5-20251001-v1:0` (India profile), `apac.amazon.nova-pro-v1:0`, `apac.amazon.nova-lite-v1:0`, `global.amazon.nova-2-lite-v1:0`. The Claude 5 family (Sonnet 5, Opus 5, Sonnet 5.5, Haiku 5.5) is "not available for this account".

Decision: the judge and letters try providers in this order:
1. Bedrock Claude Sonnet 4.6, global profile `global.anthropic.claude-sonnet-4-6`
2. Bedrock Claude Haiku 4.5, India profile `in.anthropic.claude-haiku-4-5-20251001-v1:0`
3. Bedrock Amazon Nova Pro, `apac.amazon.nova-pro-v1:0`
4. OpenAI API, key in Secrets Manager `junksnap/<stage>/openai-api-key`, typed in by the human
5. OpenRouter
The embedding signal uses Titan image embeddings (`amazon.titan-embed-image-v1`, on-demand in ap-south-1). Only blurred images go to any model. Every decision records provider, model and version.

Consequences for other lanes: `TaskConfig` defaults follow this order; `ProviderRouter` keeps an OpenAI provider as a fallback. Global and APAC profiles may serve a request from another region.

Rejected alternatives: OpenAI as the default (planned while the Free plan seemed to block cross-region profiles; Bedrock works now); Claude 5 models (not available for this account).
