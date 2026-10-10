import { afterEach, describe, expect, it, vi } from "vitest";
import type { Community } from "../../src/domain/notes/Community.js";
import { TimerScheduler } from "../../src/handlers/notes/NotesAssembly.js";
import { WordingCheck } from "../../src/services/letters/WordingCheck.js";
import { CommunityRefresher, REFRESH_WINDOW_MS } from "../../src/services/notes/CommunityRefresher.js";
import { NoteAnalyzer } from "../../src/services/notes/NoteAnalyzer.js";
import { FakeSites, RecordingLogger } from "../letters/support.js";
import { CLEAN, FakeAnalysisModel, FixedReportNotes, GOOD_READING, ManualScheduler, MemoryCommunity, MemoryNotes, siteWithoutCommunity } from "./notesSupport.js";

const SITE = "site_jdh_1";
const NOW = new Date("2026-10-10T10:00:00Z");

function refresher(writer: { save(siteId: string, community: Community): Promise<void> } = new MemoryCommunity()) {
  const logger = new RecordingLogger();
  const model = new FakeAnalysisModel();
  const notes = new MemoryNotes();
  const scheduler = new ManualScheduler();
  const base = { noteId: "note_1", siteId: SITE, language: "en", moderation: CLEAN, createdAt: "2026-10-10T09:00:00Z" } as const;
  void notes.add({ ...base, authorHash: "a", text: "Burnt again" });
  void notes.add({ ...base, noteId: "note_2", authorHash: "b", text: "Smoke near the school" });
  const parts = {
    notes,
    reportNotes: new FixedReportNotes(),
    photoReports: new FixedReportNotes(),
    sites: new FakeSites([siteWithoutCommunity()]),
    analyzer: new NoteAnalyzer(model, new WordingCheck(), logger),
    writer,
    scheduler,
    now: () => NOW,
    logger,
  };
  return { refresher: new CommunityRefresher(parts), model, scheduler, logger, writer };
}

afterEach(() => {
  vi.useRealTimers();
});

describe("CommunityRefresher debounce", () => {
  it("starts one run when two notes arrive together", async () => {
    const world = refresher();
    await Promise.all([world.refresher.noteAccepted(SITE), world.refresher.noteAccepted(SITE)]);
    expect(world.model.requests).toHaveLength(1);
    expect((world.writer as MemoryCommunity).saved).toHaveLength(1);
    expect(world.scheduler.delays).toEqual([]);
  });

  it("queues exactly one more run, after the window, for a note that lands while a run is in flight", async () => {
    const world = refresher();
    world.model.reply = () => {
      void world.refresher.noteAccepted(SITE);
      void world.refresher.noteAccepted(SITE);
      return GOOD_READING;
    };
    await world.refresher.noteAccepted(SITE);
    await Promise.resolve();
    expect(world.scheduler.delays).toEqual([REFRESH_WINDOW_MS]);
  });

  it("debounces a failed analysis too", async () => {
    const world = refresher();
    world.model.reply = () => ({ broken: true });
    await world.refresher.noteAccepted(SITE);
    await world.refresher.noteAccepted(SITE);
    expect(world.model.requests).toHaveLength(1);
    expect(world.scheduler.delays).toEqual([REFRESH_WINDOW_MS]);
  });

  it("logs a failing scheduled run instead of rejecting, and frees the site", async () => {
    const failing = { save: async () => Promise.reject(new Error("DynamoDB is down")) };
    const world = refresher(failing);
    await world.refresher.noteAccepted(SITE);
    expect(world.logger.errors).toEqual(["community refresh failed"]);
    await world.refresher.noteAccepted(SITE);
    await expect(world.scheduler.flush()).resolves.toBeUndefined();
    expect(world.logger.errors).toEqual(["community refresh failed", "community refresh failed"]);
  });
});

describe("TimerScheduler", () => {
  it("logs a task that rejects instead of leaving an unhandled rejection", async () => {
    vi.useFakeTimers();
    const logger = new RecordingLogger();
    new TimerScheduler(logger).after(1000, async () => Promise.reject(new Error("boom")));
    await vi.advanceTimersByTimeAsync(1000);
    expect(logger.errors).toEqual(["scheduled task failed"]);
  });
});
