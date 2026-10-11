import type { Site } from "../../src/contracts/index.gen.js";
import { ExternalServiceError } from "../../src/domain/errors.js";
import type { AnswerSchema } from "../../src/domain/llm/AnswerSchema.js";
import type { LlmRequest } from "../../src/domain/llm/LlmRequest.js";
import { LlmResponse } from "../../src/domain/llm/LlmResponse.js";
import type { NoteVerdict } from "../../src/domain/moderation/types.js";
import type { Community, ShownNote, StoredNote } from "../../src/domain/notes/Community.js";
import { NotesAssembly } from "../../src/handlers/notes/NotesAssembly.js";
import type { NoteModerator } from "../../src/ports/moderation/NoteModerator.js";
import type { CommunityWriter, NoteStore, ReportNoteReader, Scheduler } from "../../src/ports/notes/NoteStore.js";
import type { NoteService } from "../../src/services/notes/NoteService.js";
import { FakeSites, memoryCounters, RecordingLogger, siteFixture } from "../letters/support.js";

export const CLEAN: NoteVerdict = { result: "clean", reasons: [], provider: "bedrock", model: "apac.amazon.nova-pro-v1:0", version: "v1:0" };
export const REMOVED: NoteVerdict = { ...CLEAN, result: "removed", reasons: ["personal_data"] };

export const GOOD_READING = {
  duration_days: 90,
  recurring: true,
  burning: true,
  smell: false,
  blocked_drain: false,
  animals: false,
  near_school: true,
  near_hospital: false,
  access_issue: false,
  summary_en: "2 residents say the dump has been here about 3 months, returns after clearing and is burnt most weeks.",
  summary_hi: "2 निवासियों के अनुसार यह ढेर लगभग 3 महीने से है और अक्सर जलाया जाता है।",
};

export class FakeModerator implements NoteModerator {
  readonly seen: string[] = [];
  verdict: NoteVerdict = CLEAN;

  async review(note: string): Promise<NoteVerdict> {
    this.seen.push(note);
    return this.verdict;
  }
}

export class MemoryNotes implements NoteStore {
  readonly stored: StoredNote[] = [];

  async add(note: StoredNote): Promise<void> {
    this.stored.push(note);
  }

  async shownFor(siteId: string): Promise<ShownNote[]> {
    return this.stored.flatMap((note) => (note.siteId === siteId && note.text !== null ? [{ text: note.text, authorHash: note.authorHash }] : []));
  }
}

export class FixedReportNotes implements ReportNoteReader {
  constructor(readonly notes: ShownNote[] = []) {}

  async shownFor(): Promise<ShownNote[]> {
    return this.notes;
  }
}

export class MemoryCommunity implements CommunityWriter {
  readonly saved: { siteId: string; community: Community }[] = [];

  async save(siteId: string, community: Community): Promise<void> {
    this.saved.push({ siteId, community });
  }
}

// Runs a task only when the test calls flush(), recording each delay.
export class ManualScheduler implements Scheduler {
  readonly delays: number[] = [];
  readonly #tasks: (() => Promise<void>)[] = [];

  after(ms: number, task: () => Promise<void>): void {
    this.delays.push(ms);
    this.#tasks.push(task);
  }

  async flush(): Promise<void> {
    while (this.#tasks.length > 0) {
      await this.#tasks.shift()?.();
    }
  }
}

// Answers like the provider router: the reply goes through the caller's schema, a bad one is an ExternalServiceError.
export class FakeAnalysisModel {
  readonly requests: LlmRequest[] = [];
  provider: "bedrock" | "openai" = "bedrock";
  reply: (request: LlmRequest) => unknown = () => GOOD_READING;

  async completeJson<T>(request: LlmRequest, schema: AnswerSchema<T>): Promise<LlmResponse<T>> {
    this.requests.push(request);
    const parsed = schema.safeParse(this.reply(request));
    if (!parsed.success) {
      throw new ExternalServiceError("no LLM provider gave a usable answer for task note_analysis");
    }
    const fields = { provider: this.provider, model: "apac.amazon.nova-pro-v1:0", version: "v1:0", text: "{}", latencyMs: 1, inputTokens: 1, outputTokens: 1, costUsd: 0 };
    return LlmResponse.of(fields).withJson(parsed.data);
  }
}

export interface NotesWorld {
  readonly service: NoteService;
  readonly moderator: FakeModerator;
  readonly notes: MemoryNotes;
  readonly community: MemoryCommunity;
  readonly scheduler: ManualScheduler;
  readonly model: FakeAnalysisModel;
  readonly logger: RecordingLogger;
}

export function siteWithoutCommunity(): Site {
  const site = siteFixture("jdh-1");
  return { ...site, properties: { ...site.properties, community: null } };
}

export function notesWorld(sites: readonly Site[] = [siteWithoutCommunity()], reportNotes: ShownNote[] = [], photoReports: ShownNote[] = []): NotesWorld {
  const world = {
    moderator: new FakeModerator(),
    notes: new MemoryNotes(),
    community: new MemoryCommunity(),
    scheduler: new ManualScheduler(),
    model: new FakeAnalysisModel(),
    logger: new RecordingLogger(),
  };
  const service = new NotesAssembly(10, world.logger, 10 * 60_000).service({
    sites: new FakeSites(sites),
    notes: world.notes,
    reportNotes: new FixedReportNotes(reportNotes),
    photoReports: new FixedReportNotes(photoReports),
    writer: world.community,
    counters: memoryCounters(),
    moderator: world.moderator,
    router: world.model,
    scheduler: world.scheduler,
    now: () => new Date("2026-10-10T10:00:00Z"),
  });
  return { ...world, service };
}
