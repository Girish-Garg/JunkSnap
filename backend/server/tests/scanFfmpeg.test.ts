import { execFileSync, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import sharp from "sharp";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { FfmpegVideoFrameReader } from "../src/adapters/FfmpegVideoFrameReader.js";
import { SharpFrameHasher } from "../src/adapters/SharpFrameHasher.js";
import { TempScratchSpace } from "../src/adapters/TempScratchSpace.js";
import { validateReportUpload } from "../src/contracts/index.gen.js";
import { ExternalServiceError } from "../src/domain/errors.js";
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
// Every frame is flat grey whose video-range luma is 16 + 40 * t, so a frame's brightness says its time.
const BRIGHTNESS_RAMP = "nullsrc=size=320x240:rate=10,geq=lum='16+40*T':cb=128:cr=128";
// The JPEG is full range: video luma 16..235 spreads over 0..255, so 40 levels a second become about 46.6.
const FULL_RANGE_PER_SECOND = (40 * 255) / 219;
// Half of one 10 fps frame step, so passing proves the cut is the frame at exactly that time.
const BRIGHTNESS_TOLERANCE = FULL_RANGE_PER_SECOND / 10 / 2;
const ENCODE = ["-c:v", "libvpx-vp9", "-deadline", "realtime", "-cpu-used", "8", "-f", "webm", "-live", "1"];

let dir: string;
let clip: string;
let ramp: string;

function makeClip(source: string, path: string): void {
  execFileSync("ffmpeg", ["-v", "error", "-f", "lavfi", "-i", source, "-t", "5", ...ENCODE, "-y", path]);
}

beforeAll(async () => {
  if (!HAS_FFMPEG) {
    return;
  }
  dir = await mkdtemp(join(tmpdir(), "junksnap-scan-test-"));
  clip = join(dir, "clip.webm");
  ramp = join(dir, "ramp.webm");
  makeClip(MOVING_THEN_STILL, clip);
  makeClip(BRIGHTNESS_RAMP, ramp);
});

afterAll(async () => {
  if (dir !== undefined) {
    await rm(dir, { recursive: true, force: true });
  }
});

describe.skipIf(!HAS_FFMPEG)(HAS_FFMPEG ? "ffmpeg integration" : SKIP_REASON, () => {
  const reader = new FfmpegVideoFrameReader();
  const hasher = new SharpFrameHasher();

  it("probes the size and the last frame's time from the packets of a webm without a duration header", async () => {
    expect(await reader.probe(clip)).toEqual({ width: 320, height: 240, lastFrameMs: 4900 });
  });

  it("cuts one JPEG per time, up to and including the last frame", async () => {
    const out = await mkdtemp(join(dir, "cut-"));
    const frames = await reader.extract(clip, [0, 1500, 4000, 4900], out);
    expect(frames.map((frame) => frame.tMs)).toEqual([0, 1500, 4000, 4900]);
    const jpeg = await readFile(frames[0]?.path ?? "");
    expect([...jpeg.subarray(0, 2)]).toEqual([0xff, 0xd8]);
  });

  it("cuts the frame at exactly the asked time, judged by a brightness that rises with t", async () => {
    const out = await mkdtemp(join(dir, "ramp-"));
    const frames = await reader.extract(ramp, [1000, 3000], out);
    const brightness = await Promise.all(frames.map(async (frame) => (await sharp(frame.path).greyscale().stats()).channels[0]?.mean));
    expect(Math.abs((brightness[0] ?? 0) - 1 * FULL_RANGE_PER_SECOND)).toBeLessThan(BRIGHTNESS_TOLERANCE);
    expect(Math.abs((brightness[1] ?? 0) - 3 * FULL_RANGE_PER_SECOND)).toBeLessThan(BRIGHTNESS_TOLERANCE);
  });

  it("throws instead of skipping when a cut writes nothing, so a scan never ends with frames missing", async () => {
    const out = await mkdtemp(join(dir, "past-"));
    await expect(reader.extract(clip, [5000], out)).rejects.toThrow(ExternalServiceError);
  });

  it("kills a run that passes its time limit and throws ExternalServiceError so SQS retries", async () => {
    const out = await mkdtemp(join(dir, "slow-"));
    const impatient = new FfmpegVideoFrameReader({ timeoutMs: 1 });
    await expect(impatient.extract(clip, [1000], out)).rejects.toThrow(/stopped by SIGKILL/);
    await expect(impatient.probe(clip)).rejects.toThrow(ExternalServiceError);
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
    const rows = [...reports.rows.values()];
    expect(rows.map((row) => row.upload.scan?.t_ms)).toEqual([0, 1000, 2000, 3000]);
    for (const row of rows) {
      expect(() => validateReportUpload(row.upload)).not.toThrow();
    }
    expect(queue.messages).toHaveLength(4);
    for (const { jpeg } of media.originals.values()) {
      expect([...jpeg.subarray(0, 2)]).toEqual([0xff, 0xd8]);
    }
    expect(await readdir(root)).toEqual([]);
  });
});
