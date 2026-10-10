import type { SnapServices } from '../src/app/SnapServices';
import { QueuedReport } from '../src/domain/QueuedReport';
import { QueuedScan } from '../src/domain/QueuedScan';
import type { ReportStatus, ReportStatusView } from '../src/domain/ReportStatus';
import { MockAuthService } from '../src/services/MockAuthService';
import { FakeReportApi } from './FakeReportApi';
import { MemoryStore } from './helpers';
import { FakeClock, MemoryMetaStore, MemoryReportStore, sampleDraft, testSnapServices } from './snapFakes';

/** When the rows below were made; a rig clock later than this makes them older than the sign-in. */
export const MADE = new Date('2026-10-10T04:00:00Z');

export function listed(n: number, status: ReportStatus = 'unverified'): ReportStatusView {
  const report = { report_type: 'waste_dump', context: 'roadside', capture_mode: 'snap' as const, captured_at: '2026-10-10T03:00:00Z', sha256: `${n}`.repeat(64), gps: { lat: 26.2, lon: 73, accuracy_m: 6 } };
  return { report_id: `rpt_${n}`, status, site_id: null, blurred_url: null, updated_at: '2026-10-10T03:10:00Z', received_at: '2026-10-10T03:00:05Z', report };
}

export const sentRow = (n: number) => QueuedReport.capture(sampleDraft(`${n}`.repeat(64)), new ArrayBuffer(1), MADE).sent(`rpt_${n}`).withStatus(listed(n));
export const unsentRow = (n: number) => QueuedReport.capture(sampleDraft(`${n}`.repeat(64)), new ArrayBuffer(1), MADE);

export function scanRow(n: number, sent: boolean, at: Date = MADE): QueuedScan {
  const draft = {
    report_type: 'waste_dump', context: 'roadside', started_at: MADE.toISOString(), ended_at: MADE.toISOString(),
    duration_ms: 6000, content_type: 'video/webm', video_sha256: `${n}`.repeat(64), size_bytes: 5, gps_track: [],
  } as const;
  const recorded = QueuedScan.record(draft, new ArrayBuffer(1), at);
  return sent ? recorded.sent(`scn_${n}`) : recorded;
}

export async function signIn(auth: MockAuthService, email: string): Promise<void> {
  await auth.signUp(email, 'jodhpur2026');
  await auth.confirmSignUp(email, '123456');
}

export interface ActivityRig {
  readonly snap: SnapServices;
  readonly api: FakeReportApi;
  readonly auth: MockAuthService;
  readonly meta: MemoryMetaStore;
}

interface RigOptions {
  readonly rows?: readonly QueuedReport[];
  readonly scans?: readonly QueuedScan[];
  /** The phone's clock when the app starts; later than MADE makes the rows older than this sign-in. */
  readonly clock?: string;
  readonly meta?: MemoryMetaStore;
}

/** A signed-in phone holding these rows and videos, with a fake GET /me/reports. */
export async function activityRig(options: RigOptions = {}): Promise<ActivityRig> {
  const store = new MemoryReportStore();
  for (const row of options.rows ?? []) await store.put(row.data);
  const api = new FakeReportApi();
  const auth = new MockAuthService(new MemoryStore(), 0);
  const meta = options.meta ?? new MemoryMetaStore();
  await signIn(auth, 'resident@example.com');
  const snap = testSnapServices({ auth, api, store, meta, clock: new FakeClock(options.clock ?? MADE.toISOString()) });
  for (const scan of options.scans ?? []) await snap.scans.save(scan);
  return { snap, api, auth, meta };
}

export const reportIds = (snap: SnapServices) => snap.queue.snapshot().map((row) => row.data.report_id ?? row.id).sort();
export const scanIds = (snap: SnapServices) => snap.scans.snapshot().map((scan) => scan.id).sort();
