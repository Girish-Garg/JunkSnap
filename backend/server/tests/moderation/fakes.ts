import { createHash } from "node:crypto";
import sharp from "sharp";
import type { ReportUpload } from "../../src/contracts/index.gen.js";
import { Box } from "../../src/domain/moderation/Box.js";
import type { ImageScreening, LabeledBox, ModerationLabel } from "../../src/domain/moderation/GatePolicy.js";
import { GeoPoint } from "../../src/domain/moderation/GeoPoint.js";
import { PhotoSubmission, type Sender } from "../../src/domain/moderation/PhotoSubmission.js";
import type { FoundRegions, NoteVerdict } from "../../src/domain/moderation/types.js";
import type { Clock } from "../../src/ports/moderation/Clock.js";
import type { DeviceRegistry, DeviceStanding, PhotoWindow } from "../../src/ports/moderation/DeviceRegistry.js";
import type { FaceFinder } from "../../src/ports/moderation/FaceFinder.js";
import type { Geofence } from "../../src/ports/moderation/Geofence.js";
import type { HashIndex, IndexedPhoto } from "../../src/ports/moderation/HashIndex.js";
import type { ImageModerator } from "../../src/ports/moderation/ImageModerator.js";
import type { ImageStore } from "../../src/ports/moderation/ImageStore.js";
import type { NoteModerator } from "../../src/ports/moderation/NoteModerator.js";
import type { PlateFinder } from "../../src/ports/moderation/PlateFinder.js";

export const JODHPUR = new GeoPoint(26.26183, 73.00352);
export const DEVICE = "3f6c2a1e-8b4d-4c7a-9e21-5d0b7f3a6c14";
export const RECEIVED_AT = "2026-10-10T02:14:52Z";

export function sha256(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

// White on alternate 8 px cells inside the square from 64 to 128 px.
function checkerAt(x: number, y: number): boolean {
  const inSquare = Math.min(x, y) >= 64 && Math.max(x, y) < 128;
  return inSquare && (Math.floor(x / 8) + Math.floor(y / 8)) % 2 === 0;
}

// A smooth gradient with a sharp checkerboard square, so blurring that square changes it a lot.
export async function testJpeg(width = 256, height = 192, quality = 95): Promise<Uint8Array> {
  const pixels = Buffer.alloc(width * height * 3);
  for (let i = 0; i < width * height; i += 1) {
    const x = i % width;
    const y = Math.floor(i / width);
    pixels.fill(checkerAt(x, y) ? 255 : Math.round((x / width) * 160 + (y / height) * 60), i * 3, i * 3 + 3);
  }
  return new Uint8Array(await sharp(pixels, { raw: { width, height, channels: 3 } }).jpeg({ quality }).toBuffer());
}

// Seeded noise compresses badly: 2100 px at quality 100 is about 5.9 MB.
export async function noiseJpeg(side: number): Promise<Uint8Array> {
  const pixels = Buffer.alloc(side * side * 3);
  let seed = 12345;
  for (let i = 0; i < pixels.length; i += 1) {
    seed = (seed * 1103515245 + 12345) >>> 0;
    pixels[i] = seed >>> 24;
  }
  return new Uint8Array(await sharp(pixels, { raw: { width: side, height: side, channels: 3 } }).jpeg({ quality: 100 }).toBuffer());
}

export function reportUpload(bytes: Uint8Array, overrides: Partial<ReportUpload> = {}): ReportUpload {
  return {
    upload_id: "upl_jdh_1",
    report_type: "waste_dump",
    context: "vacant_plot",
    capture_mode: "snap",
    sha256: sha256(bytes),
    gps: { lat: JODHPUR.lat, lon: JODHPUR.lon, accuracy_m: 6 },
    device_token: DEVICE,
    captured_at: "2026-10-10T02:14:05Z",
    ...overrides,
  };
}

export function reportSubmission(bytes: Uint8Array, overrides: Partial<ReportUpload> = {}): PhotoSubmission {
  return PhotoSubmission.fromReport(reportUpload(bytes, overrides), RECEIVED_AT);
}

export class FakeImageStore implements ImageStore {
  readonly originals = new Map<string, Uint8Array>();
  readonly written = new Map<string, Uint8Array>();

  async readOriginal(key: string, maxBytes: number): Promise<Uint8Array | null> {
    const bytes = this.originals.get(key);
    if (bytes === undefined) {
      throw new Error(`no original at ${key}`);
    }
    return bytes.byteLength > maxBytes ? null : bytes;
  }

  async writePublic(key: string, jpeg: Uint8Array): Promise<void> {
    this.written.set(key, jpeg);
  }
}

export const REKOGNITION_STAMP = { provider: "rekognition", model: "DetectModerationLabels+DetectLabels", version: "7.0+3.0" } as const;

export class FakeImageModerator implements ImageModerator {
  moderationLabels: ModerationLabel[] = [];
  people: Box[] = [];
  waste: LabeledBox[] = [];
  readonly seen: Uint8Array[] = [];

  async screen(jpeg: Uint8Array): Promise<ImageScreening> {
    this.seen.push(jpeg);
    return { moderationLabels: this.moderationLabels, people: this.people, waste: this.waste, stamp: REKOGNITION_STAMP };
  }
}

export class FakeFinder implements FaceFinder, PlateFinder {
  readonly #model: string;
  readonly #version: string | null;
  boxes: Box[] = [];

  constructor(model: string, version: string | null) {
    this.#model = model;
    this.#version = version;
  }

  async find(): Promise<FoundRegions> {
    return { boxes: this.boxes, model: this.#model, version: this.#version };
  }
}

export class FakeHashIndex implements HashIndex {
  photos: IndexedPhoto[] = [];

  async near(): Promise<IndexedPhoto[]> {
    return this.photos;
  }
}

export class FakeDeviceRegistry implements DeviceRegistry {
  readonly standings: Record<Sender["kind"], DeviceStanding> = {
    device: { known: true, reputation: 0.74, blocked: false },
    user: { known: true, reputation: 0.8, blocked: false },
  };
  readonly counts: Record<Sender["kind"], number> = { device: 1, user: 1 };
  readonly windows: PhotoWindow[] = [];

  async standing(sender: Sender): Promise<DeviceStanding> {
    return this.standings[sender.kind];
  }

  async snapPhotos(window: PhotoWindow): Promise<number> {
    this.windows.push(window);
    return this.counts[window.sender.kind];
  }
}

export class FakeGeofence implements Geofence {
  inside = true;

  covers(): boolean {
    return this.inside;
  }
}

export class FakeClock implements Clock {
  now(): Date {
    return new Date("2026-10-10T02:15:03.250Z");
  }
}

export class FakeCleanNoteModerator implements NoteModerator {
  async review(): Promise<NoteVerdict> {
    return { result: "clean", reasons: [], provider: "bedrock", model: "test-model", version: "1" };
  }
}

export class FakeRemovingNoteModerator implements NoteModerator {
  async review(): Promise<NoteVerdict> {
    return { result: "removed", reasons: ["personal_data"], provider: "bedrock", model: "test-model", version: "1" };
  }
}

export function box(left: number, top: number, width: number, height: number): Box {
  return new Box(left, top, width, height);
}
