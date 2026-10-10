import { describe, expect, it } from "vitest";
import { authorHash } from "../../src/domain/notes/AuthorHash.js";
import { ScheduledCommunityRefresh } from "../../src/services/notes/ScheduledCommunityRefresh.js";
import { DEVICE, USER } from "../letters/support.js";
import { notesWorld } from "../notes/notesSupport.js";

const NOTE = { siteId: "site_jdh_1", text: "Burnt again last night.", language: "en", requester: { deviceToken: DEVICE, userId: USER }, authorHash: authorHash(USER) } as const;
const PHOTO_REPORT = { text: "That photo shows the next street.", authorHash: "someone-else", source: "photo_report" } as const;

describe("photo report descriptions in the community analysis", () => {
  it("go to the model in their own field, never as notes or people, and never into the summary", async () => {
    const world = notesWorld(undefined, [], [PHOTO_REPORT]);
    await world.service.add(NOTE);
    await world.scheduler.flush();
    const input = JSON.parse(world.model.requests[0]?.userText ?? "{}") as Record<string, unknown>;
    expect(input).toEqual({ people: 1, notes: [NOTE.text], photo_reports: [PHOTO_REPORT.text] });
    expect(world.model.requests[0]?.system).toContain("never quote them");
    const [saved] = world.community.saved;
    expect(saved?.community).toMatchObject({ notes_count: 1, people: 1 });
    expect(JSON.stringify(saved?.community)).not.toContain("next street");
  });

  it("leave the model input as before when there are none", async () => {
    const world = notesWorld();
    await world.service.add(NOTE);
    await world.scheduler.flush();
    expect(JSON.parse(world.model.requests[0]?.userText ?? "{}")).not.toHaveProperty("photo_reports");
  });

  it("start a refresh through the shared refresher after a shown description", async () => {
    const world = notesWorld();
    await world.service.add(NOTE);
    await world.scheduler.flush();
    const refresher = { calls: [] as string[], async noteAccepted(siteId: string) { this.calls.push(siteId); } };
    new ScheduledCommunityRefresh(world.scheduler, refresher as never, world.logger).textAccepted("site_jdh_1");
    await world.scheduler.flush();
    expect(refresher.calls).toEqual(["site_jdh_1"]);
  });
});
