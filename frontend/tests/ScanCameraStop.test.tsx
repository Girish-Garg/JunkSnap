import { act, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, expect, it, vi } from 'vitest';
import { AppRoutes } from '../src/app/AppRoutes';
import { CHECK_MS, STALL_MS } from '../src/services/LiveCamera';
import { FakeTrack, fakeStream } from './cameraFakes';
import { MemoryStore, renderApp, testServices } from './helpers';
import { FakeScanApi } from './scanFakes';
import { FakeClock } from './snapFakes';

vi.mock('../src/features/map/components/SiteMapView', () => ({ SiteMapView: () => null }));

afterEach(() => vi.useRealTimers());

// A camera whose one track the test can mute, as Android does when the camera is taken away.
function cameraWith(track: FakeTrack): MediaDevices & { opens: number } {
  const media = {
    opens: 0,
    getUserMedia: async () => {
      media.opens += 1;
      return fakeStream(track);
    },
  };
  return media as unknown as MediaDevices & { opens: number };
}

// The camera watchdog checks every CHECK_MS on the page's timers and times a freeze with performance.now().
// Fake timers that still follow real time let the app run as usual, and let the test move the watchdog on
// instead of sleeping through STALL_MS of real time, which a busy machine stretched past the test timeout.
const passWatchdog = (ms: number) => act(() => vi.advanceTimersByTimeAsync(ms));

// Signed in, Video mode, recording 5 s; then the camera freezes (jsdom has no
// requestVideoFrameCallback, so a muted track is the freeze signal).
async function freezeWhileRecording() {
  vi.useFakeTimers({ shouldAdvanceTime: true, toFake: ['setTimeout', 'clearTimeout', 'performance'] });
  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
  const clock = new FakeClock();
  const track = new FakeTrack();
  const camera = cameraWith(track);
  const services = testServices(new MemoryStore(), { scanApi: new FakeScanApi(), clock, mediaDevices: camera });
  await services.auth.signUp('resident@example.com', 'jodhpur2026');
  await services.auth.confirmSignUp('resident@example.com', '123456');
  await renderApp(<AppRoutes />, { route: '/snap', services });
  await user.click(screen.getByRole('button', { name: 'Video' }));
  const record = await screen.findByRole('button', { name: 'Start recording' });
  await waitFor(() => expect(record).toBeEnabled());
  const opens = camera.opens; // Photo opened the camera, then Video did
  const freeze = async () => {
    track.muted = true;
    clock.advance(5_000);
    await passWatchdog(STALL_MS + CHECK_MS);
  };
  return { services, camera, opens, start: () => user.click(record), freeze };
}

it('Scan: a camera that freezes mid-recording ends the recording, keeps the clip and says so', async () => {
  const test = await freezeWhileRecording();
  await test.start();
  await test.freeze();
  expect(await screen.findByText('Camera stopped. Your clip so far is saved.')).toBeInTheDocument();
  expect(screen.getByRole('heading', { level: 2, name: 'Video saved' })).toBeInTheDocument();
  expect(test.camera.opens).toBe(test.opens); // the camera was not reopened under the recording
});

it('Scan: the camera is not reopened while the cut recording is still being saved', async () => {
  const test = await freezeWhileRecording();
  const queue = test.services.snap.scans;
  const add = queue.add.bind(queue);
  let finishSaving = () => undefined as void;
  const saving = vi.spyOn(queue, 'add').mockImplementation((draft, video) => new Promise((resolve) => (finishSaving = () => void add(draft, video).then(resolve))));
  await test.start();
  await test.freeze();
  await waitFor(() => expect(saving).toHaveBeenCalled());
  await passWatchdog(3 * CHECK_MS); // three watchdog checks with the camera still frozen
  expect(test.camera.opens).toBe(test.opens);
  finishSaving();
  expect(await screen.findByText('Camera stopped. Your clip so far is saved.')).toBeInTheDocument();
});
