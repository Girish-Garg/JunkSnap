import { AccountKey } from '../services/AccountKey';
import { ActivityFreshness } from '../services/ActivityFreshness';
import { ActivityOwnership } from '../services/ActivityOwnership';
import { ActivitySync } from '../services/ActivitySync';
import type { AreaLetterApi } from '../services/AreaLetterApi';
import { AreaLetterService } from '../services/AreaLetterService';
import { areaFixtureLoaders } from '../services/areaFixtures';
import type { AuthService } from '../services/AuthService';
import { crawlFixtureLoaders } from '../services/crawlFixtures';
import { HttpAreaLetterApi } from '../services/HttpAreaLetterApi';
import { MockAreaApi } from '../services/MockAreaApi';
import { MockAreaLetterApi } from '../services/MockAreaLetterApi';
import { CameraCapture } from '../services/CameraCapture';
import { CompassHeading } from '../services/CompassHeading';
import type { Clock } from '../services/Clock';
import { DeviceIdentity } from '../services/DeviceIdentity';
import { DismissedReports } from '../services/DismissedReports';
import { GpsWatcher } from '../services/GpsWatcher';
import { HttpReportApi } from '../services/HttpReportApi';
import { HttpScanApi } from '../services/HttpScanApi';
import { IndexedDbMetaStore } from '../services/IndexedDbMetaStore';
import { IndexedDbReportStore } from '../services/IndexedDbReportStore';
import { IndexedDbScanStore } from '../services/IndexedDbScanStore';
import { JunkSnapDb } from '../services/JunkSnapDb';
import { MockConfirmations } from '../services/MockConfirmations';
import { MockReportApi } from '../services/MockReportApi';
import { MockReportEvidence } from '../services/MockReportEvidence';
import { MockScanApi } from '../services/MockScanApi';
import { NoBinReporter } from '../services/NoBinReporter';
import { ActivityRemover } from '../services/ActivityRemover';
import { PhotoEncoder } from '../services/PhotoEncoder';
import { PhotoHasher } from '../services/PhotoHasher';
import { QueueLock } from '../services/QueueLock';
import type { ReportApi, RequestIdentity } from '../services/ReportApi';
import { reportEvidenceLoaders } from '../services/reportFixtures';
import { ReportConfirmer } from '../services/ReportConfirmer';
import { ReportQueue } from '../services/ReportQueue';
import { ReportSender } from '../services/ReportSender';
import { ReportTracker } from '../services/ReportTracker';
import type { ScanApi } from '../services/ScanApi';
import { ScanCapture } from '../services/ScanCapture';
import { ScanQueue } from '../services/ScanQueue';
import { ScanSender } from '../services/ScanSender';
import { ScanTracker } from '../services/ScanTracker';
import { sampleAreaLetterLoader, sampleLetterLoader, sampleSiteLoader, siteFixtureLoaders } from '../services/siteFixtures';
import { EvictingSiteActionsApi } from '../services/EvictingSiteActionsApi';
import { HttpSiteActionsApi } from '../services/HttpSiteActionsApi';
import type { SiteCacheEviction } from '../services/SiteCacheEviction';
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
  /** Where device orientation events fire (window) for the compass heading. */
  readonly orientation?: EventTarget;
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
  mock: () => {
    const evidence = new MockReportEvidence(reportEvidenceLoaders);
    return {
      reports: new MockReportApi(sampleSiteLoader, undefined, evidence, new MockConfirmations(reportEvidenceLoaders.confirm)),
      scans: new MockScanApi(undefined, evidence),
      sites: new MockSiteActionsApi({ site: (id) => mockSites.getSite(id), letter: sampleLetterLoader }),
      areaLetters: mockAreaLetters(),
    };
  },
  live: (config, identity) => ({
    reports: new HttpReportApi(config.requireApiUrl(), identity),
    scans: new HttpScanApi(config.requireApiUrl(), identity),
    sites: new HttpSiteActionsApi(config.requireApiUrl(), identity),
    areaLetters: new HttpAreaLetterApi(config.requireApiUrl(), identity),
  }),
};

interface ActionParts {
  readonly apis: Apis;
  readonly identity: RequestIdentity;
  readonly gps: GpsWatcher;
  readonly queue: ReportQueue;
  readonly scans: ScanQueue;
  readonly random: () => Uint8Array;
  readonly dismissed: DismissedReports;
}

interface ActivityParts {
  readonly apis: Apis;
  readonly queue: ReportQueue;
  readonly scans: ScanQueue;
  readonly clock: Clock;
  readonly identity: RequestIdentity;
  readonly dismissed: DismissedReports;
  readonly meta: IndexedDbMetaStore;
}

const NO_EVICTION: SiteCacheEviction = { forgetSite: () => undefined };

interface QueueParts {
  readonly db: JunkSnapDb;
  readonly apis: Apis;
  readonly identity: RequestIdentity;
  readonly clock: Clock;
}

export class SnapServiceFactory {
  static build(config: AppConfig, browser: SnapBrowserApis, auth: AuthService, eviction: SiteCacheEviction = NO_EVICTION): SnapServices {
    const db = new JunkSnapDb();
    const meta = new IndexedDbMetaStore(db);
    const device = new DeviceIdentity(meta, () => browser.crypto.getRandomValues(new Uint8Array(16)));
    const identity: RequestIdentity = { idToken: (force) => auth.idToken(force), deviceToken: () => device.token() };
    const built = API_BUILDERS[config.apiMode](config, identity);
    const apis: Apis = { ...built, sites: new EvictingSiteActionsApi(built.sites, eviction) };
    const clock = new SystemClock();
    const queue = SnapServiceFactory.#reportQueue({ db, apis, identity, clock }, browser.locks);
    const scans = SnapServiceFactory.#scanQueue({ db, apis, identity, clock }, browser.locks);
    const recorder = new VideoRecorder(browser.mediaRecorder, clock);
    const hasher = new PhotoHasher(browser.crypto.subtle);
    const gps = new GpsWatcher(browser.geolocation, clock);
    const dismissed = new DismissedReports(meta);
    return {
      queue,
      ...SnapServiceFactory.#reportStatus(apis, identity, queue),
      activity: SnapServiceFactory.#activity({ apis, queue, scans, clock, identity, dismissed, meta }, auth, browser.crypto),
      scans,
      scanTracker: new ScanTracker(apis.scans, scans),
      recorder,
      scanCapture: new ScanCapture({ recorder, gps, hasher, queue: scans, clock }),
      camera: new CameraCapture(browser.mediaDevices),
      encoder: new PhotoEncoder(),
      hasher,
      gps,
      compass: new CompassHeading(browser.orientation ?? null),
      ...SnapServiceFactory.#actions({ apis, identity, gps, queue, scans, dismissed, random: () => browser.crypto.getRandomValues(new Uint8Array(16)) }),
    };
  }

  // Report statuses, and the reporter's answer when the check was unsure (contracts v1.16).
  static #reportStatus(apis: Apis, identity: RequestIdentity, queue: ReportQueue): Pick<SnapServices, 'tracker' | 'confirmer'> {
    return { tracker: new ReportTracker(apis.reports, queue), confirmer: new ReportConfirmer({ api: apis.reports, identity, queue }) };
  }

  // Activity's server sync follows sign-in changes from the start.
  static #activity(parts: ActivityParts, auth: AuthService, crypto: Crypto): ActivitySync {
    const { apis, queue, scans, clock, identity, dismissed, meta } = parts;
    const account = new AccountKey(identity, crypto.subtle);
    const freshness = new ActivityFreshness(meta, clock);
    const ownership = new ActivityOwnership({ queue, scans, freshness, account, meta, clock });
    const activity = new ActivitySync({ api: apis.reports, queue, freshness, ownership, dismissed, account, clock });
    activity.watch(auth);
    return activity;
  }

  // Site actions, Activity deletes and area letters share the sign-in gate and the device token.
  static #actions(parts: ActionParts): Pick<SnapServices, 'siteActions' | 'areaLetters' | 'noBin' | 'remover'> {
    const { apis, identity, gps, queue, scans, random, dismissed } = parts;
    const siteActions = new SiteActionService({ api: apis.sites, uploads: apis.reports, identity, gps });
    return {
      siteActions,
      areaLetters: new AreaLetterService(apis.areaLetters, identity),
      noBin: new NoBinReporter(apis.reports, identity, random, queue),
      remover: new ActivityRemover({ reports: queue, scans, statuses: apis.reports, sites: siteActions, dismissed, marks: new ReportTracker(apis.reports, queue) }),
    };
  }

  static #reportQueue(parts: QueueParts, locks: LockManager | undefined): ReportQueue {
    const sender = new ReportSender(parts.apis.reports, parts.identity, parts.clock);
    return new ReportQueue({ store: new IndexedDbReportStore(parts.db), sender, clock: parts.clock, lock: new QueueLock(locks) });
  }

  static #scanQueue(parts: QueueParts, locks: LockManager | undefined): ScanQueue {
    const sender = new ScanSender(parts.apis.scans, parts.identity, parts.clock);
    const lock = new QueueLock(locks, 'junksnap-scan-queue');
    return new ScanQueue({ store: new IndexedDbScanStore(parts.db), sender, clock: parts.clock, lock });
  }
}
