import { describe, expect, it } from "vitest";
import { PublicReblur, type ObjectSource, type ReblurOptions } from "../../scripts/reblur/PublicReblur.js";
import { SharpBlurrer } from "../../src/adapters/moderation/SharpBlurrer.js";
import { SharpImageCodec } from "../../src/adapters/moderation/SharpImageCodec.js";
import { BLUR_POLICY } from "../../src/domain/moderation/BlurPlanner.js";
import { PhotoId } from "../../src/domain/moderation/PhotoId.js";
import { PhotoLoader } from "../../src/services/moderation/PhotoLoader.js";
import { PrivacyBlur } from "../../src/services/moderation/PrivacyBlur.js";
import { box, FakeFinder, FakeImageStore, FakeSubjectFinder, testJpeg } from "./fakes.js";

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
  const reblur = new PublicReblur({ objects, loader: new PhotoLoader(store, new SharpImageCodec()), blur, buckets: BUCKETS }, { dryRun: false, force: false, ...options });
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
