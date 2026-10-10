import type { AreaLetterApi } from '../services/AreaLetterApi';
import { AreaLetterService } from '../services/AreaLetterService';
import { areaFixtureLoaders } from '../services/areaFixtures';
import type { AuthService } from '../services/AuthService';
import { crawlFixtureLoaders } from '../services/crawlFixtures';
import { HttpAreaLetterApi } from '../services/HttpAreaLetterApi';
import { MockAreaApi } from '../services/MockAreaApi';
import { MockAreaLetterApi } from '../services/MockAreaLetterApi';
import { CameraCapture } from '../services/CameraCapture';
import type { Clock } from '../services/Clock';
import { DeviceIdentity } from '../services/DeviceIdentity';
import { GpsWatcher } from '../services/GpsWatcher';
import { HttpReportApi } from '../services/HttpReportApi';
import { HttpScanApi } from '../services/HttpScanApi';
import { IndexedDbMetaStore } from '../services/IndexedDbMetaStore';
import { IndexedDbReportStore } from '../services/IndexedDbReportStore';
import { IndexedDbScanStore } from '../services/IndexedDbScanStore';
import { JunkSnapDb } from '../services/JunkSnapDb';
import { MockReportApi } from '../services/MockReportApi';
import { MockScanApi } from '../services/MockScanApi';
import { PhotoEncoder } from '../services/PhotoEncoder';
import { PhotoHasher } from '../services/PhotoHasher';
import { QueueLock } from '../services/QueueLock';
import type { ReportApi, RequestIdentity } from '../services/ReportApi';
import { ReportQueue } from '../services/ReportQueue';
import { ReportSender } from '../services/ReportSender';
import { ReportTracker } from '../services/ReportTracker';
import type { ScanApi } from '../services/ScanApi';
import { ScanCapture } from '../services/ScanCapture';
import { ScanQueue } from '../services/ScanQueue';
import { ScanSender } from '../services/ScanSender';
import { ScanTracker } from '../services/ScanTracker';
import { sampleAreaLetterLoader, sampleLetterLoader, sampleSiteLoader, siteFixtureLoaders } from '../services/siteFixtures';
import { HttpSiteActionsApi } from '../services/HttpSiteActionsApi';
import { MockApiClient } from '../services/MockApiClient';
import { MockSiteActionsApi } from '../services/MockSiteActionsApi';
import { SiteActionService } from '../services/SiteActionService';
import type { SiteActionsApi } from '../services/SiteActionsApi';
import { SystemClock } from '../services/SystemClock';
import { VideoRecorder, type RecorderFactory } from '../services/VideoRecorder';
import type { ApiMode, AppConfig } from './AppConfig';
import type { SnapServices } from './SnapServices';

export interface SnapBrowserApis {
  readonly geolocation: Geolocation | undefined;
  readonly mediaDevices: MediaDevices | undefined;
  readonly crypto: Crypto;
  readonly locks: LockManager | undefined;
  readonly mediaRecorder?: RecorderFactory;
}

interface Apis {
  readonly reports: ReportApi;
  readonly scans: ScanApi;
  readonly sites: SiteActionsApi;
  readonly areaLetters: AreaLetterApi;
}

const mockSites = new MockApiClient(siteFixtureLoaders);
const mockAreas = new MockAreaApi(areaFixtureLoaders, siteFixtureLoaders, crawlFixtureLoaders);
const mockAreaLetters = () =>
  new MockAreaLetterApi({
    scores: (kind, id) => mockAreas.scores(kind, id),
    letter: sampleAreaLetterLoader,
  });

const API_BUILDERS: Readonly<Record<ApiMode, (config: AppConfig, identity: RequestIdentity) => Apis>> = {
  mock: () => ({
    reports: new MockReportApi(sampleSiteLoader),
    scans: new MockScanApi(),
    sites: new MockSiteActionsApi({ site: (id) => mockSites.getSite(id), letter: sampleLetterLoader }),
    areaLetters: mockAreaLetters(),
  }),
  live: (config, identity) => ({
    reports: new HttpReportApi(config.requireApiUrl(), identity),
    scans: new HttpScanApi(config.requireApiUrl(), identity),
    sites: new HttpSiteActionsApi(config.requireApiUrl(), identity),
    areaLetters: new HttpAreaLetterApi(config.requireApiUrl(), identity),
  }),
};

export class SnapServiceFactory {
  static build(config: AppConfig, browser: SnapBrowserApis, auth: AuthService): SnapServices {
    const db = new JunkSnapDb();
    const device = new DeviceIdentity(new IndexedDbMetaStore(db), () => browser.crypto.getRandomValues(new Uint8Array(16)));
    const identity: RequestIdentity = { idToken: (force) => auth.idToken(force), deviceToken: () => device.token() };
    const apis = API_BUILDERS[config.apiMode](config, identity);
    const clock = new SystemClock();
    const queue = new ReportQueue({
      store: new IndexedDbReportStore(db),
      sender: new ReportSender(apis.reports, identity, clock),
      clock,
      lock: new QueueLock(browser.locks),
    });
    const scans = SnapServiceFactory.#scanQueue({ db, apis, identity, clock }, browser.locks);
    const recorder = new VideoRecorder(browser.mediaRecorder, clock);
    const hasher = new PhotoHasher(browser.crypto.subtle);
    const gps = new GpsWatcher(browser.geolocation, clock);
    return {
      queue,
      tracker: new ReportTracker(apis.reports, queue),
      scans,
      scanTracker: new ScanTracker(apis.scans, scans),
      recorder,
      scanCapture: new ScanCapture({ recorder, gps, hasher, queue: scans, clock }),
      camera: new CameraCapture(browser.mediaDevices),
      encoder: new PhotoEncoder(),
      hasher,
      gps,
      ...SnapServiceFactory.#actions(apis, identity, gps),
    };
  }

  // Site actions and area letters share the sign-in gate and the device token.
  static #actions(apis: Apis, identity: RequestIdentity, gps: GpsWatcher): Pick<SnapServices, 'siteActions' | 'areaLetters'> {
    return {
      siteActions: new SiteActionService({ api: apis.sites, uploads: apis.reports, identity, gps }),
      areaLetters: new AreaLetterService(apis.areaLetters, identity),
    };
  }

  static #scanQueue(parts: { db: JunkSnapDb; apis: Apis; identity: RequestIdentity; clock: Clock }, locks: LockManager | undefined): ScanQueue {
    const sender = new ScanSender(parts.apis.scans, parts.identity, parts.clock);
    const lock = new QueueLock(locks, 'junksnap-scan-queue');
    return new ScanQueue({ store: new IndexedDbScanStore(parts.db), sender, clock: parts.clock, lock });
  }
}
