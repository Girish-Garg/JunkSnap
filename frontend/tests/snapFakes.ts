import type { SnapServices } from '../src/app/SnapServices';
import type { QueuedReportData } from '../src/domain/QueuedReport';
import type { GpsFix, ReportDraft } from '../src/domain/ReportUpload';
import type { AuthService } from '../src/services/AuthService';
import { CameraCapture } from '../src/services/CameraCapture';
import type { Clock } from '../src/services/Clock';
import { DeviceIdentity } from '../src/services/DeviceIdentity';
import { GpsWatcher } from '../src/services/GpsWatcher';
import { MockReportApi } from '../src/services/MockReportApi';
import type { ImageEncoder } from '../src/services/PhotoEncoder';
import { PhotoHasher } from '../src/services/PhotoHasher';
import { QueueLock } from '../src/services/QueueLock';
import type { ReportApi, RequestIdentity } from '../src/services/ReportApi';
import { ReportQueue } from '../src/services/ReportQueue';
import { ReportSender } from '../src/services/ReportSender';
import type { MetaStore, ReportStore } from '../src/services/ReportStore';
import { ReportTracker } from '../src/services/ReportTracker';
import { sampleSiteLoader } from '../src/services/siteFixtures';

export const DEVICE_TOKEN = '3f6c2a1e-8b4d-4c7a-9e21-5d0b7f3a6c14';

export class MemoryReportStore implements ReportStore {
  readonly rows = new Map<string, QueuedReportData>();

  async all(): Promise<readonly QueuedReportData[]> {
    return [...this.rows.values()];
  }

  async get(id: string): Promise<QueuedReportData | undefined> {
    return this.rows.get(id);
  }

  async put(report: QueuedReportData): Promise<void> {
    this.rows.set(report.id, report);
  }

  async delete(id: string): Promise<void> {
    this.rows.delete(id);
  }
}

export class MemoryMetaStore implements MetaStore {
  readonly values = new Map<string, string>();

  async get(key: string): Promise<string | undefined> {
    return this.values.get(key);
  }

  async set(key: string, value: string): Promise<void> {
    this.values.set(key, value);
  }
}

export class FakeClock implements Clock {
  #time: number;

  constructor(iso = '2026-10-10T04:00:00Z') {
    this.#time = Date.parse(iso);
  }

  now(): Date {
    return new Date(this.#time);
  }

  advance(ms: number): void {
    this.#time += ms;
  }
}

/** Every capture is these bytes, so tests know the hash. */
export class FakeEncoder implements ImageEncoder {
  readonly bytes = new TextEncoder().encode('jpeg bytes').buffer;

  async fromVideo(): Promise<ArrayBuffer> {
    return this.bytes;
  }
}

/** watchPosition that reports the first fix at once; emit() sends later ones, fail() a problem. */
export class FakeGeolocation {
  #onFix: PositionCallback | null = null;
  #onError: PositionErrorCallback | null = null;
  readonly #first: GpsFix | null;

  constructor(first: GpsFix | null = { lat: 26.26183, lon: 73.00352, accuracy_m: 6 }) {
    this.#first = first;
  }

  api(): Geolocation {
    return {
      watchPosition: (onFix: PositionCallback, onError: PositionErrorCallback) => {
        this.#onFix = onFix;
        this.#onError = onError;
        if (this.#first) this.emit(this.#first);
        return 1;
      },
      clearWatch: () => undefined,
    } as unknown as Geolocation;
  }

  emit({ lat, lon, accuracy_m }: GpsFix): void {
    const coords = { latitude: lat, longitude: lon, accuracy: accuracy_m } as GeolocationCoordinates;
    this.#onFix?.({ coords, timestamp: Date.now() } as GeolocationPosition);
  }

  fail(code: number): void {
    this.#onError?.({ code } as GeolocationPositionError);
  }
}

export function fixedGeolocation(accuracy = 6): Geolocation {
  return new FakeGeolocation({ lat: 26.26183, lon: 73.00352, accuracy_m: accuracy }).api();
}

/** getUserMedia that hands back an empty stream, or rejects with the given DOMException name. */
export function fakeMediaDevices(failWith?: string): MediaDevices & { readonly calls: number } {
  const media = {
    calls: 0,
    getUserMedia: async () => {
      media.calls += 1;
      if (failWith) throw new DOMException('camera', failWith);
      return { getTracks: () => [] } as unknown as MediaStream;
    },
  };
  return media as unknown as MediaDevices & { readonly calls: number };
}

export const fixedIdentity = (idToken: string | null = null): RequestIdentity => ({
  idToken: async () => idToken,
  deviceToken: async () => DEVICE_TOKEN,
});

export function sampleDraft(sha256 = 'a'.repeat(64)): ReportDraft {
  const gps = { lat: 26.26183, lon: 73.00352, accuracy_m: 6 };
  return { report_type: 'waste_dump', context: 'vacant_plot', sha256, gps, captured_at: '2026-10-10T04:00:00Z' };
}

export interface SnapTestOptions {
  readonly auth: AuthService;
  readonly api?: ReportApi;
  readonly geolocation?: Geolocation;
  readonly store?: ReportStore;
  /** null leaves the page without a camera API. */
  readonly mediaDevices?: MediaDevices | null;
}

export function testSnapServices(options: SnapTestOptions): SnapServices {
  const clock = new FakeClock();
  const device = new DeviceIdentity(new MemoryMetaStore(), () => crypto.getRandomValues(new Uint8Array(16)));
  const identity: RequestIdentity = { idToken: (force) => options.auth.idToken(force), deviceToken: () => device.token() };
  const api = options.api ?? new MockReportApi(sampleSiteLoader, 0);
  const store = options.store ?? new MemoryReportStore();
  const queue = new ReportQueue({ store, sender: new ReportSender(api, identity, clock), clock, lock: new QueueLock(undefined) });
  const media = options.mediaDevices === null ? undefined : (options.mediaDevices ?? fakeMediaDevices());
  return {
    queue,
    tracker: new ReportTracker(api, queue),
    camera: new CameraCapture(media),
    encoder: new FakeEncoder(),
    hasher: new PhotoHasher(crypto.subtle),
    gps: new GpsWatcher(options.geolocation ?? fixedGeolocation()),
  };
}
