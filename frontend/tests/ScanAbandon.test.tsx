import { screen, waitFor, within } from '@testing-library/react';
import userEvent, { type UserEvent } from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AppRoutes } from '../src/app/AppRoutes';
import type { QueuedScanData } from '../src/domain/QueuedScan';
import { GpsWatcher } from '../src/services/GpsWatcher';
import { PhotoHasher } from '../src/services/PhotoHasher';
import { QueueLock } from '../src/services/QueueLock';
import { ScanCapture } from '../src/services/ScanCapture';
import { ScanQueue } from '../src/services/ScanQueue';
import { ScanSender } from '../src/services/ScanSender';
import { VideoRecorder } from '../src/services/VideoRecorder';
import { fakeStream } from './cameraFakes';
import { MemoryStore, renderApp, testServices } from './helpers';
import { FakeMediaRecorder, FakeScanApi, fakeRecorderFactory } from './scanFakes';
import { FakeClock, MemoryItemStore, fixedIdentity } from './snapFakes';

vi.mock('../src/features/map/components/SiteMapView', () => ({ SiteMapView: () => null }));

afterEach(() => vi.useRealTimers());

const FIX = { lat: 26.26183, lon: 73.00352, accuracy_m: 6 };
const AUTO = { report_type: 'auto', context: 'auto' } as const;
const settle = (ms = 50) => new Promise((resolve) => setTimeout(resolve, ms));

// ScanCapture on a fake recorder, with a geolocation that counts its watches.
function captureRig() {
  const clock = new FakeClock();
  const watches = { opened: 0, cleared: 0 };
  const geolocation = { watchPosition: () => ++watches.opened, clearWatch: () => void ++watches.cleared } as unknown as Geolocation;
  const store = new MemoryItemStore<QueuedScanData>();
  const queue = new ScanQueue({ store, sender: new ScanSender(new FakeScanApi(), fixedIdentity('t'), clock), clock, lock: new QueueLock(undefined) });
  const recorder = new VideoRecorder(fakeRecorderFactory, clock);
  const capture = new ScanCapture({ recorder, gps: new GpsWatcher(geolocation, clock), hasher: new PhotoHasher(crypto.subtle), queue, clock });
  const ticks: number[] = [];
  const start = () => capture.start({ stream: fakeStream(), firstFix: { fix: FIX }, choice: AUTO, onTick: (ms) => ticks.push(ms) });
  return { clock, watches, store, ticks, start };
}

describe('ScanCapture.cancel', () => {
  it('stops the recorder, the GPS watch and the ticker, and never queues the clip', async () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
    const rig = captureRig();
    const run = rig.start();
    rig.clock.advance(5_000);
    run.cancel();
    expect(FakeMediaRecorder.last?.state).toBe('inactive');
    expect(rig.watches.cleared).toBe(1);
    await expect(run.saved).resolves.toBeNull();
    const ticks = rig.ticks.length;
    vi.advanceTimersByTime(2_000);
    expect(rig.ticks.length).toBe(ticks);
    expect(rig.store.rows.size).toBe(0);
  });

  it('changes nothing once the recording was stopped: a stopped clip is still saved', async () => {
    const rig = captureRig();
    const run = rig.start();
    rig.clock.advance(5_000);
    run.stop();
    run.cancel();
    await expect(run.saved).resolves.toMatchObject({ data: { draft: { duration_ms: 5_000 } } });
    expect(rig.store.rows.size).toBe(1);
  });
});

async function recording(user: UserEvent) {
  const clock = new FakeClock();
  const scanApi = new FakeScanApi();
  const services = testServices(new MemoryStore(), { scanApi, clock });
  await services.auth.signUp('resident@example.com', 'jodhpur2026');
  await services.auth.confirmSignUp('resident@example.com', '123456');
  await renderApp(<AppRoutes />, { route: '/snap', services });
  await user.click(screen.getByRole('button', { name: 'Video' }));
  const record = await screen.findByRole('button', { name: 'Start recording' });
  await waitFor(() => expect(record).toBeEnabled());
  await user.click(record);
  clock.advance(5_000);
  return { services, scanApi, clock };
}

describe('Scan the user abandons', () => {
  it('is discarded when the sheet closes mid-recording, even when the recorder stops later', async () => {
    const user = userEvent.setup();
    const { services, scanApi } = await recording(user);
    const recorder = FakeMediaRecorder.last;
    await user.click(screen.getByRole('button', { name: 'Close' }));
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Stop recording' })).not.toBeInTheDocument());
    expect(recorder?.state).toBe('inactive');
    recorder?.stop(); // the camera's tracks end after the sheet is gone
    await settle();
    expect(services.snap.scans.snapshot()).toEqual([]);
    expect(scanApi.calls).toEqual([]);
  });

  it('cannot switch to Photo or No bin while recording', async () => {
    const user = userEvent.setup();
    await recording(user);
    const modes = screen.getByRole('group', { name: 'Capture' });
    expect(within(modes).getByRole('button', { name: 'Photo' })).toBeDisabled();
    expect(within(modes).getByRole('button', { name: 'No bin here' })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'Stop recording' }));
    expect(await screen.findByRole('heading', { level: 2, name: 'Video saved' })).toBeInTheDocument();
  });
});
