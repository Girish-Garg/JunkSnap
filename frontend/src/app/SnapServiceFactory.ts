import type { AuthService } from '../services/AuthService';
import { CameraCapture } from '../services/CameraCapture';
import { DeviceIdentity } from '../services/DeviceIdentity';
import { GpsWatcher } from '../services/GpsWatcher';
import { HttpReportApi } from '../services/HttpReportApi';
import { IndexedDbMetaStore } from '../services/IndexedDbMetaStore';
import { IndexedDbReportStore } from '../services/IndexedDbReportStore';
import { JunkSnapDb } from '../services/JunkSnapDb';
import { MockReportApi } from '../services/MockReportApi';
import { PhotoEncoder } from '../services/PhotoEncoder';
import { PhotoHasher } from '../services/PhotoHasher';
import { QueueLock } from '../services/QueueLock';
import type { ReportApi, RequestIdentity } from '../services/ReportApi';
import { ReportQueue } from '../services/ReportQueue';
import { ReportSender } from '../services/ReportSender';
import { ReportTracker } from '../services/ReportTracker';
import { sampleSiteLoader } from '../services/siteFixtures';
import { SystemClock } from '../services/SystemClock';
import type { ApiMode, AppConfig } from './AppConfig';
import type { SnapServices } from './SnapServices';

export interface SnapBrowserApis {
  readonly geolocation: Geolocation | undefined;
  readonly mediaDevices: MediaDevices | undefined;
  readonly crypto: Crypto;
  readonly locks: LockManager | undefined;
}

const REPORT_API_BUILDERS: Readonly<Record<ApiMode, (config: AppConfig, identity: RequestIdentity) => ReportApi>> = {
  mock: () => new MockReportApi(sampleSiteLoader),
  live: (config, identity) => new HttpReportApi(config.requireApiUrl(), identity),
};

export class SnapServiceFactory {
  static build(config: AppConfig, browser: SnapBrowserApis, auth: AuthService): SnapServices {
    const db = new JunkSnapDb();
    const device = new DeviceIdentity(new IndexedDbMetaStore(db), () => browser.crypto.getRandomValues(new Uint8Array(16)));
    const identity: RequestIdentity = { idToken: () => auth.idToken(), deviceToken: () => device.token() };
    const api = REPORT_API_BUILDERS[config.apiMode](config, identity);
    const clock = new SystemClock();
    const sender = new ReportSender(api, identity, clock);
    const queue = new ReportQueue({ store: new IndexedDbReportStore(db), sender, clock, lock: new QueueLock(browser.locks) });
    return {
      queue,
      tracker: new ReportTracker(api, queue),
      camera: new CameraCapture(browser.mediaDevices),
      encoder: new PhotoEncoder(),
      hasher: new PhotoHasher(browser.crypto.subtle),
      gps: new GpsWatcher(browser.geolocation),
    };
  }
}
