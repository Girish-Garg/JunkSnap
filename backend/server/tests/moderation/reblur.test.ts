import { HeadObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { describe, expect, it, vi } from "vitest";
import { PublicReblur, type ObjectSource, type ReblurOptions } from "../../scripts/reblur/PublicReblur.js";
import { parseReblurArgs } from "../../scripts/reblur/ReblurArgs.js";
import { S3Objects } from "../../scripts/reblur/S3Objects.js";
import { SharpBlurrer } from "../../src/adapters/moderation/SharpBlurrer.js";
import { SharpImageCodec } from "../../src/adapters/moderation/SharpImageCodec.js";
import { BLUR_POLICY } from "../../src/domain/moderation/BlurPlanner.js";
import { PhotoId } from "../../src/domain/moderation/PhotoId.js";
import { PhotoLoader } from "../../src/services/moderation/PhotoLoader.js";
import { PrivacyBlur } from "../../src/services/moderation/PrivacyBlur.js";
import { box, FakeFinder, FakeImageStore, FakeSubjectFinder, testJpeg } from "./fakes.js";
import { MODERATION } from "../defaults.js";

const BUCKETS = { originals: "junksnap-dev-originals-1", public: "junksnap-dev-public-1" };
const KEY = "media/reports/rpt_jdh_1.jpg";

class MapObjects implements ObjectSource {
  readonly objects = new Map<string, Uint8Array>();
  readonly policies = new Map<string, string>();

  async blurPolicy(_bucket: string, key: string): Promise<string | null> {
    return this.policies.get(key) ?? null;
  }

  async read(bucket: string, key: string): Promise<Uint8Array | null> {
    return this.objects.get(`${bucket}/${key}`) ?? null;
  }
}

function setUp(options: Partial<ReblurOptions> = {}) {
  const objects = new MapObjects();
  const store = new FakeImageStore();
  const subjects = new FakeSubjectFinder();
  subjects.subjects = [{ kind: "two_wheeler", box: box(0.3, 0.4, 0.3, 0.5), confidence: 90 }];
  const blur = new PrivacyBlur({ faces: new FakeFinder("DetectFaces", null), plates: new FakeFinder("DetectText", "3.0"), subjects, blurrer: new SharpBlurrer(), store });
  const reblur = new PublicReblur({ objects, loader: new PhotoLoader(store, new SharpImageCodec(), MODERATION.maxUploadBytes), blur, buckets: BUCKETS }, { dryRun: false, force: false, ...options });
  return { objects, store, reblur };
}

describe("PhotoId.fromBlurredKey", () => {
  it("reads report and cleanup copies back to their originals and refuses other keys", () => {
    expect(PhotoId.fromBlurredKey(KEY)?.privateOriginalKey()).toBe("reports/upl_jdh_1.jpg");
    expect(PhotoId.fromBlurredKey("media/cleanups/cln_x2.jpg")?.privateOriginalKey()).toBe("cleanups/upl_x2.jpg");
    expect(PhotoId.fromBlurredKey("media/reports/rpt_x.png")).toBeNull();
    expect(PhotoId.fromBlurredKey("media/cleanups/rpt_x.jpg")).toBeNull();
  });
});

describe("PublicReblur", () => {
  it("re-blurs from the original and overwrites the public copy", async () => {
    const { objects, store, reblur } = setUp();
    objects.objects.set(`${BUCKETS.originals}/reports/upl_jdh_1.jpg`, await testJpeg());
    const outcome = await reblur.one(KEY);
    expect(outcome).toMatchObject({ action: "reblurred" });
    expect(outcome.detail).toContain('"plate_zones":1');
    expect(store.written.has(KEY)).toBe(true);
  });

  it("is idempotent: a copy already under the current policy is left alone unless forced", async () => {
    const { objects, store, reblur } = setUp();
    objects.policies.set(KEY, BLUR_POLICY);
    expect(await reblur.one(KEY)).toMatchObject({ action: "current" });
    expect(store.written.size).toBe(0);
    const forced = setUp({ force: true });
    forced.objects.policies.set(KEY, BLUR_POLICY);
    forced.objects.objects.set(`${BUCKETS.originals}/reports/upl_jdh_1.jpg`, await testJpeg());
    expect(await forced.reblur.one(KEY)).toMatchObject({ action: "reblurred" });
  });

  it("writes nothing in a dry run", async () => {
    const { objects, store, reblur } = setUp({ dryRun: true });
    objects.objects.set(`${BUCKETS.originals}/reports/upl_jdh_1.jpg`, await testJpeg());
    expect(await reblur.one(KEY)).toEqual({ key: KEY, action: "would_reblur", detail: "from the original" });
    expect(store.written.size).toBe(0);
  });

  it("blurs the old public copy again when the original is gone, and skips when both are", async () => {
    const { objects, reblur } = setUp();
    expect(await reblur.one(KEY)).toMatchObject({ action: "skipped" });
    objects.objects.set(`${BUCKETS.public}/${KEY}`, await testJpeg());
    expect(await reblur.one(KEY)).toMatchObject({ action: "reblurred", detail: expect.stringContaining("public copy") });
    expect(await reblur.one("media/reports/index.html")).toMatchObject({ action: "skipped" });
  });
});

describe("PublicReblur.attempt", () => {
  it("reports a key that throws as failed instead of stopping the run", async () => {
    const { objects, reblur } = setUp();
    vi.spyOn(objects, "read").mockRejectedValue(Object.assign(new Error("Access Denied"), { name: "AccessDenied" }));
    expect(await reblur.attempt(KEY)).toEqual({ key: KEY, action: "failed", detail: "AccessDenied: Access Denied" });
  });
});

describe("S3Objects", () => {
  it("reads a missing copy's blur policy as none, and stamped metadata as the policy", async () => {
    const client = new S3Client({ region: "ap-south-1" });
    const send = vi.spyOn(client as unknown as { send: (command: object) => Promise<unknown> }, "send");
    send.mockRejectedValueOnce(Object.assign(new Error("not found"), { name: "NotFound" }));
    send.mockResolvedValueOnce({ Metadata: { "blur-policy": BLUR_POLICY } });
    const objects = new S3Objects(client);
    expect(await objects.blurPolicy(BUCKETS.public, KEY)).toBeNull();
    expect(await objects.blurPolicy(BUCKETS.public, KEY)).toBe(BLUR_POLICY);
    expect(send.mock.calls[1]?.[0]).toBeInstanceOf(HeadObjectCommand);
  });
});

describe("parseReblurArgs", () => {
  const dev = ["--originals-bucket", "junksnap-dev-originals-1", "--public-bucket", "junksnap-dev-public-1"];

  it("reads the stage, buckets and flags", () => {
    expect(parseReblurArgs(["dev", ...dev, "--dry-run"])).toEqual({ buckets: BUCKETS, options: { dryRun: true, force: false }, key: undefined });
    expect(parseReblurArgs(["dev", ...dev, "--force", "--key", KEY])).toMatchObject({ options: { dryRun: false, force: true }, key: KEY });
  });

  it("refuses buckets of another stage, an unknown stage and missing buckets", () => {
    expect(() => parseReblurArgs(["demo", ...dev])).toThrow(/usage/);
    expect(() => parseReblurArgs(["prod", ...dev])).toThrow(/usage/);
    expect(() => parseReblurArgs(["dev", "--originals-bucket", "junksnap-dev-originals-1", "--public-bucket", "junksnap-demo-public-1"])).toThrow(/usage/);
    expect(() => parseReblurArgs(["dev"])).toThrow(/usage/);
  });
});
