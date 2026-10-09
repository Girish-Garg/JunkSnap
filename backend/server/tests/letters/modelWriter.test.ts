import { describe, expect, it } from "vitest";
import { ModelLetterWriter } from "../../src/adapters/letters/ModelLetterWriter.js";
import { ExternalServiceError } from "../../src/domain/errors.js";
import type { AnswerSchema } from "../../src/domain/llm/AnswerSchema.js";
import type { LlmRequest } from "../../src/domain/llm/LlmRequest.js";
import { LlmResponse } from "../../src/domain/llm/LlmResponse.js";
import type { LetterModel } from "../../src/ports/letters/LetterModel.js";
import { DEVICE, USER, letterService, REAL_RULES_DIR, RecordingLogger, wardSite } from "./support.js";

const ANSWER = { provider: "bedrock", model: "apac.amazon.nova-pro-v1:0", version: "v1:0" } as const;

// Answers like the provider router: the raw reply goes through the caller's schema first.
class FakeModel implements LetterModel {
  readonly requests: LlmRequest[] = [];
  readonly #reply: (request: LlmRequest) => unknown;

  constructor(reply: (request: LlmRequest) => unknown) {
    this.#reply = reply;
  }

  async completeJson<T>(request: LlmRequest, schema: AnswerSchema<T>): Promise<LlmResponse<T>> {
    this.requests.push(request);
    const parsed = schema.safeParse(this.#reply(request));
    if (!parsed.success) {
      throw new ExternalServiceError("no LLM provider gave a usable answer for task letters");
    }
    const fields = { ...ANSWER, text: "{}", latencyMs: 900, inputTokens: 800, outputTokens: 400, costUsd: 0.002 };
    return LlmResponse.of(fields).withJson(parsed.data);
  }
}

// What a careful model writes: each citation quoted word for word from the user text.
function carefulReply(request: LlmRequest): unknown {
  const facts = JSON.parse(request.userText) as { citations: { clause: string; quote: string }[] };
  const quotes = facts.citations.map((citation) => `Rule ${citation.clause} reads "${citation.quote}".`);
  return { subject: "Request to clear a waste site", body: `To the Commissioner.\n\n${quotes.join("\n")}` };
}

const request = {
  siteId: "site_jdh_1",
  channel: "local_body",
  language: "hi",
  requester: { deviceToken: DEVICE, userId: USER },
} as const;

describe("ModelLetterWriter", () => {
  it("asks the letters task for JSON prose with code-picked facts only", async () => {
    const model = new FakeModel(carefulReply);
    const service = await letterService({ sites: [wardSite()], writer: new ModelLetterWriter(model), rulesDir: REAL_RULES_DIR });
    const letter = await service.draft(request);
    const [sent] = model.requests;
    expect(sent).toMatchObject({ task: "letters", jsonSchemaName: "letter_prose" });
    expect(sent?.system).toContain("Hindi");
    expect(sent?.system).toContain("exactly as given");
    expect(sent?.userText).toContain('"marking": "for attention"');
    expect(sent?.userText).not.toContain(DEVICE);
    expect(letter).toMatchObject({ template_fallback: false, ...ANSWER, verifier: { verified: 4, total: 4 } });
  });

  it("falls back to the template when the model's answer is not prose JSON", async () => {
    const logger = new RecordingLogger();
    const model = new FakeModel(() => ({ letter: "Dear Sir" }));
    const service = await letterService({ sites: [wardSite()], writer: new ModelLetterWriter(model), logger });
    const letter = await service.draft(request);
    expect(letter).toMatchObject({ template_fallback: true, provider: "junksnap", model: "letter-template" });
    expect(logger.warnings).toEqual([expect.stringContaining("letter writer failed")]);
  });

  it("falls back to the template when the model rewords a quote", async () => {
    const model = new FakeModel((sent) => {
      const reply = carefulReply(sent) as { subject: string; body: string };
      return { ...reply, body: reply.body.replace("vulnerable", "sensitive") };
    });
    const service = await letterService({ sites: [wardSite()], writer: new ModelLetterWriter(model), rulesDir: REAL_RULES_DIR });
    const letter = await service.draft(request);
    expect(letter.template_fallback).toBe(true);
    expect(letter.body).not.toContain("sensitive");
  });
});
