import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { describe, expect, it, vi } from "vitest";
import { DynamoHashIndex } from "../src/adapters/moderation/DynamoHashIndex.js";
import { DynamoReader } from "../src/adapters/moderation/DynamoReader.js";
import type { ReportUpload } from "../src/contracts/index.gen.js";
import { PhotoSubmission } from "../src/domain/moderation/PhotoSubmission.js";
import { Report } from "../src/domain/Report.js";
import { ReportPlacement } from "../src/domain/ReportPlacement.js";
import { fixture } from "./reportFakes.js";
import { RULES } from "./defaults.js";

// Decision 20261011-0400: authenticity stays on the phone's GPS fix; only the site uses the long-range target.
const RECEIVED = "2026-10-11T03:40:30Z";
const far = () => fixture<ReportUpload>("report_upload.jdh-far");
// An earlier long-range photo taken from the same spot, merged into a site about 450 m north of the reporter.
const SITE_NORTH = { lat: 26.2912 + 450 / 111_195, lon: 73.0301 };

function index(): { index: DynamoHashIndex; queried: string[] } {
  const client = DynamoDBDocumentClient.from(new DynamoDBClient({ region: "ap-south-1" }));
  const queried: string[] = [];
  vi.spyOn(client as unknown as { send: (command: { input: Record<string, unknown> }) => Promise<unknown> }, "send").mockImplementation(
    async ({ input }) => {
      if (input.IndexName === "by-geohash") return { Items: [{ site_id: "site_far", ...SITE_NORTH }] };
      queried.push(String((input.ExpressionAttributeValues as Record<string, unknown>)[":site"]));
      const gps = { lat: far().gps.lat, lon: far().gps.lon };
      return { Items: [{ report_id: "rpt_earlier", gps, moderation_result: { phash: "c4e1b3a59d0f2687" } }] };
    },
  );
  return { index: new DynamoHashIndex(new DynamoReader(client), { reports: "reports", sites: "sites" }, RULES.siteMergeRadiusM + RULES.targetMaxM), queried };
}

describe("long-range authenticity uses the phone's GPS", () => {
  it("moderates the photo at the reporter's fix, never at the target", () => {
    const { location } = PhotoSubmission.fromReport(far(), RECEIVED).fields;
    expect(location).toMatchObject({ lat: far().gps.lat, lon: far().gps.lon });
    expect(location.lat).not.toBe(ReportPlacement.of(far()).spot.lat);
  });

  it("finds an earlier photo from the same fix even when its site sits far off at a long-range target", async () => {
    const { index: hashes, queried } = index();
    const photos = await hashes.earlierPhotos(PhotoSubmission.fromReport(far(), RECEIVED), 100);
    expect(queried).toEqual(["site_far"]);
    const location = expect.objectContaining({ lat: far().gps.lat, lon: far().gps.lon });
    expect(photos).toEqual([expect.objectContaining({ photoId: "rpt_earlier", location })]);
  });

  it("sends ml the GPS accuracy of the reporter's fix", () => {
    const request = Report.receive(far(), RECEIVED, "user-1").verifyRequest({ reputation: 0.5, nearby_verified_reports: 0 });
    expect(request.features.gps_accuracy_m).toBe(far().gps.accuracy_m);
  });
});
