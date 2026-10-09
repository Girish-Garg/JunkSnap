import type { SnapServices } from '../src/app/SnapServices';
import type { QueuedReportData } from '../src/domain/QueuedReport';
import type { ReportDraft } from '../src/domain/ReportUpload';
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

  async fromFile(): Promise<ArrayBuffer> {
    return this.bytes;
  }
}

/** watchPosition that reports one fix at once. */
export function fixedGeolocation(accuracy = 6): Geolocation {
  const coords = { latitude: 26.26183, longitude: 73.00352, accuracy } as GeolocationCoordinates;
  return {
    watchPosition: (onFix: PositionCallback) => {
      onFix({ coords, timestamp: Date.now() } as GeolocationPosition);
      return 1;
    },
    clearWatch: () => undefined,
    getCurrentPosition: () => undefined,
  } as unknown as Geolocation;
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
}

export function testSnapServices(options: SnapTestOptions): SnapServices {
  const clock = new FakeClock();
  const device = new DeviceIdentity(new MemoryMetaStore(), () => crypto.getRandomValues(new Uint8Array(16)));
  const identity: RequestIdentity = { idToken: () => options.auth.idToken(), deviceToken: () => device.token() };
  const api = options.api ?? new MockReportApi(sampleSiteLoader, 0);
  const store = options.store ?? new MemoryReportStore();
  const queue = new ReportQueue({ store, sender: new ReportSender(api, identity, clock), clock, lock: new QueueLock(undefined) });
  return {
    queue,
    tracker: new ReportTracker(api, queue),
    camera: new CameraCapture(undefined),
    encoder: new FakeEncoder(),
    hasher: new PhotoHasher(crypto.subtle),
    gps: new GpsWatcher(options.geolocation ?? fixedGeolocation()),
  };
}
