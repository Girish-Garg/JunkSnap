import { execFileSync, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { FfmpegVideoFrameReader } from "../src/adapters/FfmpegVideoFrameReader.js";
import { SharpFrameHasher } from "../src/adapters/SharpFrameHasher.js";
import { TempScratchSpace } from "../src/adapters/TempScratchSpace.js";
import { InvalidVideoError } from "../src/domain/scanErrors.js";
import { FramePlanner } from "../src/services/FramePlanner.js";
import { FrameSelector } from "../src/services/FrameSelector.js";
import { ScanFramePublisher } from "../src/services/ScanFramePublisher.js";
import { ScanFrameSampler } from "../src/services/ScanFrameSampler.js";
import { ScanVideoLoader } from "../src/services/ScanVideoLoader.js";
import { VideoScanProcessor } from "../src/services/VideoScanProcessor.js";
import {
  FakeFrameReportRepository,
  FakeMediaStore,
  FakeScanQueue,
  FakeScanRepository,
  NOW,
  queuedRecord,
  sampleSession,
  testLogger,
} from "./scanFakes.js";

const HAS_FFMPEG = spawnSync("ffmpeg", ["-version"]).status === 0;
const SKIP_REASON = "ffmpeg integration tests skipped: ffmpeg is not on PATH (install it, e.g. apt-get install ffmpeg)";
if (!HAS_FFMPEG) {
  console.warn(SKIP_REASON);
}

// 5 s of a moving pattern that freezes from 3 s, like a scooter stopping; cue-less webm as MediaRecorder writes it.
const MOVING_THEN_STILL = "nullsrc=size=320x240:rate=10,geq=lum='128+100*sin(X/25+min(T,3)*2.1)':cb=128:cr=128";

let dir: string;
let clip: string;

beforeAll(async () => {
  if (!HAS_FFMPEG) {
    return;
  }
  dir = await mkdtemp(join(tmpdir(), "junksnap-scan-test-"));
  clip = join(dir, "clip.webm");
  const encode = ["-c:v", "libvpx-vp9", "-deadline", "realtime", "-cpu-used", "8", "-f", "webm", "-live", "1"];
  execFileSync("ffmpeg", ["-v", "error", "-f", "lavfi", "-i", MOVING_THEN_STILL, "-t", "5", ...encode, "-y", clip]);
});

afterAll(async () => {
  if (dir !== undefined) {
    await rm(dir, { recursive: true, force: true });
  }
});

describe.skipIf(!HAS_FFMPEG)(HAS_FFMPEG ? "ffmpeg integration" : SKIP_REASON, () => {
  const reader = new FfmpegVideoFrameReader();
  const hasher = new SharpFrameHasher();

  it("probes the video size", async () => {
    expect(await reader.probe(clip)).toEqual({ width: 320, height: 240 });
  });

  it("cuts one JPEG per time and leaves out times past the end", async () => {
    const out = await mkdtemp(join(dir, "cut-"));
    const frames = await reader.extract(clip, [0, 1500, 4000, 7000], out);
    expect(frames.map((frame) => frame.tMs)).toEqual([0, 1500, 4000]);
    const jpeg = await readFile(frames[0]?.path ?? "");
    expect([...jpeg.subarray(0, 2)]).toEqual([0xff, 0xd8]);
  });

  it("hashes moving views far apart and the frozen ones as duplicates", async () => {
    const out = await mkdtemp(join(dir, "hash-"));
    const frames = await reader.extract(clip, [1000, 2000, 3000, 4000], out);
    const [a, b, c, d] = await Promise.all(frames.map((frame) => hasher.hash(frame.path)));
    expect(a && b && a.distanceTo(b)).toBeGreaterThan(10);
    expect(b && c && b.distanceTo(c)).toBeGreaterThan(10);
    expect(c && d && c.distanceTo(d)).toBeLessThanOrEqual(5);
  });

  it("refuses a file that is not a video", async () => {
    const junk = join(dir, "junk.webm");
    await writeFile(junk, "not a video at all");
    await expect(reader.probe(junk)).rejects.toThrow(InvalidVideoError);
  });

  it("runs the whole processor on the clip with fakes for S3, DynamoDB and SQS", async () => {
    const root = await mkdtemp(join(dir, "scratch-"));
    const scratch = new TempScratchSpace(root);
    const scans = new FakeScanRepository();
    const media = new FakeMediaStore(clip);
    const reports = new FakeFrameReportRepository();
    const queue = new FakeScanQueue();
    const sha = createHash("sha256").update(await readFile(clip)).digest("hex");
    const track = sampleSession().gps_track.slice(0, 6);
    const session = sampleSession({ duration_ms: 5000, video_sha256: sha, gps_track: track, hints: undefined });
    scans.rows.set(session.scan_id, queuedRecord(session));
    const now = (): Date => NOW;
    const sampler = new ScanFrameSampler({ reader, hasher, planner: new FramePlanner(), selector: new FrameSelector() });
    const publisher = new ScanFramePublisher({ media, reports, queue, scratch }, now);
    const loader = new ScanVideoLoader(media, reader);
    const deps = { scans, scratch, loader, sampler, publisher, logger: testLogger(), now };
    await new VideoScanProcessor(deps).process(session.scan_id);

    expect(scans.rows.get(session.scan_id)).toMatchObject({
      status: "done",
      frames: { sampled: 5, kept: 4, dropped_no_fix: 0 },
    });
    const times = [...reports.rows.values()].map((row) => row.upload.scan.t_ms);
    expect(times).toEqual([0, 1000, 2000, 3000]);
    expect(queue.messages).toHaveLength(4);
    for (const { jpeg } of media.originals.values()) {
      expect([...jpeg.subarray(0, 2)]).toEqual([0xff, 0xd8]);
    }
    expect(await readdir(root)).toEqual([]);
  });
});
