import { describe, expect, it } from "vitest";
import { BytesImageSource } from "./BytesImageSource.js";
import { JUDGE_ANSWER_SCHEMA } from "../../src/adapters/brands/JudgeAnswerSchema.js";
import { BlurredImage } from "../../src/domain/brands/BlurredImage.js";
import { Box } from "../../src/domain/brands/Box.js";
import { ExternalServiceError } from "../../src/domain/errors.js";
import type { LlmTask } from "../../src/domain/llm/LlmTask.js";
import { TaskConfig } from "../../src/domain/llm/TaskConfig.js";
import type { JudgeCase } from "../../src/ports/brands/BrandJudge.js";
import { BrandJudgeStep } from "../../src/services/brands/BrandJudgeStep.js";
import { BrandLabeller } from "../../src/services/brands/BrandLabeller.js";
import { LlmBrandJudge } from "../../src/services/brands/LlmBrandJudge.js";
import { ProviderFactory } from "../../src/services/llm/ProviderFactory.js";
import { ProviderRouter } from "../../src/services/llm/ProviderRouter.js";
import { FakeLlmProvider, FakeProviderBuilder, testLogger } from "../llm/fakes.js";
import { LogSink } from "../LogSink.js";
import { ENTRIES, FakeBrandMap, FakeTextPresence, FakeTextReader, line } from "./fakes.js";
import { TIMEOUTS } from "../defaults.js";

const IMAGE = new BlurredImage("rpt_jdh_1");
const JPEG = new Uint8Array([255, 216, 255]);

function judgeAnswering(script: string[]) {
  const provider = new FakeLlmProvider("bedrock", "judge-a", script);
  const tasks = new Map<LlmTask, TaskConfig>([["brands", new TaskConfig("bedrock", "judge-a")]]);
  const factory = new ProviderFactory([new FakeProviderBuilder("bedrock", { "judge-a": provider })]);
  const router = new ProviderRouter(tasks, factory, testLogger(new LogSink()), { budgetMs: TIMEOUTS.llm.budgetMs });
  const images = new BytesImageSource(new Map([[IMAGE.reportId, JPEG]]));
  return { provider, judge: new LlmBrandJudge({ router, images, schema: JUDGE_ANSWER_SCHEMA }) };
}

function verdictJson(...verdicts: object[]): string {
  return JSON.stringify({ verdicts });
}

const [PEPSI] = ENTRIES;
const BIKAJI = ENTRIES.find((entry) => entry.brand === "Bikaji");
const CASES: JudgeCase[] = [
  { id: "near-0", textSeen: "PEPSl", box: new Box({ left: 0.1, top: 0.5, width: 0.15, height: 0.05 }), options: PEPSI ? [PEPSI] : [] },
  { id: "unread-text", textSeen: "", box: Box.WHOLE_IMAGE, options: BIKAJI ? [BIKAJI] : [] },
];

describe("LlmBrandJudge", () => {
  it("sends the blurred JPEG with each case's region and brand names only, and records the model that answered", async () => {
    const answer = verdictJson(
      { case_id: "near-0", brand: "Pepsi", confidence: 0.93, text_seen: "PEPSI" },
      { case_id: "unread-text", brand: null, confidence: 0.2, text_seen: "" },
    );
    const { provider, judge } = judgeAnswering([`\`\`\`json\n${answer}\n\`\`\``]);
    const source = { provider: "bedrock", model: "judge-a", version: "test-1" };
    expect(await judge.judge(IMAGE, CASES)).toEqual([
      { caseId: "near-0", brand: "Pepsi", confidence: 0.93, textSeen: "PEPSI", source },
      { caseId: "unread-text", brand: null, confidence: 0.2, textSeen: "", source },
    ]);
    const request = provider.requests[0];
    expect([request?.task, request?.images]).toEqual(["brands", [{ bytes: JPEG, format: "jpeg" }]]);
    expect(request?.userText.split("\n")).toEqual([
      'case near-0: region left=0.1 top=0.5 width=0.15 height=0.05; OCR read "PEPSl"; offered brands: Pepsi',
      "case unread-text: region left=0 top=0 width=1 height=1; OCR could not read the text here (it may be Devanagari); offered brands: Bikaji",
    ]);
  });

  it("retries an answer that breaks the schema, then gives up with ExternalServiceError", async () => {
    const outOfRange = verdictJson({ case_id: "near-0", brand: "Pepsi", confidence: 1.5, text_seen: "PEPSI" });
    const { provider, judge } = judgeAnswering([outOfRange, "no JSON here"]);
    await expect(judge.judge(IMAGE, CASES)).rejects.toThrow(ExternalServiceError);
    expect(provider.requests).toHaveLength(2);
  });

  it("turns a confirmed near-threshold match into a label from the LLM", async () => {
    const answer = verdictJson({ case_id: "near-0", brand: "Pepsi", confidence: 0.9, text_seen: "PEPSI" });
    const { judge } = judgeAnswering([answer]);
    const labeller = new BrandLabeller({
      reader: new FakeTextReader([line(["PEPSI", 0.7])]),
      map: new FakeBrandMap(),
      judgeStep: new BrandJudgeStep(judge, new FakeTextPresence(false), testLogger(new LogSink())),
    });
    expect(await labeller.label(IMAGE)).toMatchObject([{ brand: "Pepsi", confidence: 0.9, provider: "bedrock", model: "judge-a" }]);
  });
});
