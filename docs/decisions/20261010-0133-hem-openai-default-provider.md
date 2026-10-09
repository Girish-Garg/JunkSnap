---
status: proposed
superseded_by:
area: agent
by: hem
date: 2026-10-10T01:33+05:30
---
# OpenAI API is the default model provider while the account is on the Free plan

Context: the AWS Free plan blocks Bedrock cross-region inference profiles, and every current Claude model needs one.

Decision: the judge, brands and letters default to the OpenAI API. The key lives in Secrets Manager as `junksnap/<stage>/openai-api-key`, typed in by the human. If the account moves to the Paid plan, Bedrock Claude Sonnet 5 through the India profile `in.anthropic.claude-sonnet-5` becomes the default. OpenRouter is the last fallback. Titan image embeddings (`amazon.titan-embed-image-v1`, on-demand in ap-south-1) stay on Bedrock. Only blurred images ever leave AWS. Every decision records provider, model and version.

Consequences for other lanes: `ProviderRouter` gains an OpenAI provider and the `TaskConfig` defaults change. The human stores the key before A1 runs live.

Rejected alternatives: Bedrock Claude as the default now (blocked on the Free plan); OpenRouter as the default (kept as the last fallback).
