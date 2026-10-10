import type { SnapServices } from '../src/app/SnapServices';
import type { AreaLetterApi } from '../src/services/AreaLetterApi';
import { AreaLetterService } from '../src/services/AreaLetterService';
import { areaFixtureLoaders } from '../src/services/areaFixtures';
import { crawlFixtureLoaders } from '../src/services/crawlFixtures';
import { MockAreaApi } from '../src/services/MockAreaApi';
import { MockAreaLetterApi } from '../src/services/MockAreaLetterApi';
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
import type { ItemStore, MetaStore, ReportStore } from '../src/services/ReportStore';
import { ReportTracker } from '../src/services/ReportTracker';
import type { ScanApi } from '../src/services/ScanApi';
import { ScanCapture } from '../src/services/ScanCapture';
import { ScanQueue } from '../src/services/ScanQueue';
import { ScanSender } from '../src/services/ScanSender';
import { ScanTracker } from '../src/services/ScanTracker';
import { sampleAreaLetterLoader, sampleLetterLoader, sampleSiteLoader, siteFixtureLoaders } from '../src/services/siteFixtures';
import { MockApiClient } from '../src/services/MockApiClient';
import { MockSiteActionsApi } from '../src/services/MockSiteActionsApi';
import { SiteActionService, type SiteActionPorts } from '../src/services/SiteActionService';
import type { SiteActionsApi } from '../src/services/SiteActionsApi';
import { MockScanApi } from '../src/services/MockScanApi';
import { VideoRecorder } from '../src/services/VideoRecorder';
import type { QueueItemData } from '../src/domain/QueueItem';
import type { QueuedScanData } from '../src/domain/QueuedScan';
import { fakeRecorderFactory } from './scanFakes';

export const DEVICE_TOKEN = '3f6c2a1e-8b4d-4c7a-9e21-5d0b7f3a6c14';

export class MemoryItemStore<Data extends QueueItemData> implements ItemStore<Data> {
  readonly rows = new Map<string, Data>();

  async all(): Promise<readonly Data[]> {
    return [...this.rows.values()];
  }

  async get(id: string): Promise<Data | undefined> {
    return this.rows.get(id);
  }

  async put(item: Data): Promise<void> {
    this.rows.set(item.id, item);
  }

  async delete(id: string): Promise<void> {
    this.rows.delete(id);
  }
}

export class MemoryReportStore extends MemoryItemStore<QueuedReportData> {}

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
      getCurrentPosition: (onFix: PositionCallback, onError: PositionErrorCallback) => {
        const first = this.#first;
        if (!first) return onError({ code: 2, message: 'no fix' } as GeolocationPositionError);
        const coords = { latitude: first.lat, longitude: first.lon, accuracy: first.accuracy_m } as GeolocationCoordinates;
        onFix({ coords, timestamp: Date.now() } as GeolocationPosition);
      },
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
  readonly scanApi?: ScanApi;
  readonly geolocation?: Geolocation;
  readonly store?: ReportStore;
  /** null leaves the page without a camera API. */
  readonly mediaDevices?: MediaDevices | null;
  readonly clock?: FakeClock;
  readonly siteApi?: SiteActionsApi;
  readonly areaLetterApi?: AreaLetterApi;
}

export function testSnapServices(options: SnapTestOptions): SnapServices {
  const clock = options.clock ?? new FakeClock();
  const device = new DeviceIdentity(new MemoryMetaStore(), () => crypto.getRandomValues(new Uint8Array(16)));
  const identity: RequestIdentity = { idToken: (force) => options.auth.idToken(force), deviceToken: () => device.token() };
  const api = options.api ?? new MockReportApi(sampleSiteLoader, 0);
  const store = options.store ?? new MemoryReportStore();
  const queue = new ReportQueue({ store, sender: new ReportSender(api, identity, clock), clock, lock: new QueueLock(undefined) });
  const media = options.mediaDevices === null ? undefined : (options.mediaDevices ?? fakeMediaDevices());
  const scanApi = options.scanApi ?? new MockScanApi(0);
  const scans = new ScanQueue({ store: new MemoryItemStore<QueuedScanData>(), sender: new ScanSender(scanApi, identity, clock), clock, lock: new QueueLock(undefined) });
  const recorder = new VideoRecorder(fakeRecorderFactory, clock);
  const hasher = new PhotoHasher(crypto.subtle);
  const gps = new GpsWatcher(options.geolocation ?? fixedGeolocation(), clock);
  return {
    queue,
    tracker: new ReportTracker(api, queue),
    scans,
    scanTracker: new ScanTracker(scanApi, scans),
    recorder,
    scanCapture: new ScanCapture({ recorder, gps, hasher, queue: scans, clock }),
    camera: new CameraCapture(media),
    encoder: new FakeEncoder(),
    hasher,
    gps,
    siteActions: testSiteActions(options.siteApi, { uploads: api, identity, gps }),
    areaLetters: new AreaLetterService(testAreaLetterApi(options.areaLetterApi), identity),
  };
}

function testSiteActions(siteApi: SiteActionsApi | undefined, ports: Omit<SiteActionPorts, 'api'>): SiteActionService {
  const sites = new MockApiClient(siteFixtureLoaders);
  const api = siteApi ?? new MockSiteActionsApi({ site: (id) => sites.getSite(id), letter: sampleLetterLoader }, 0);
  return new SiteActionService({ ...ports, api });
}

function testAreaLetterApi(given: AreaLetterApi | undefined): AreaLetterApi {
  if (given) return given;
  const areas = new MockAreaApi(areaFixtureLoaders, siteFixtureLoaders, crawlFixtureLoaders);
  return new MockAreaLetterApi({ scores: (kind, id) => areas.scores(kind, id), letter: sampleAreaLetterLoader });
}
