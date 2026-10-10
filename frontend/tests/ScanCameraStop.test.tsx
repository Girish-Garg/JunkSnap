import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, it, vi } from 'vitest';
import { AppRoutes } from '../src/app/AppRoutes';
import { FakeTrack, fakeStream } from './cameraFakes';
import { MemoryStore, renderApp, testServices } from './helpers';
import { FakeScanApi } from './scanFakes';
import { FakeClock } from './snapFakes';

vi.mock('../src/features/map/components/SiteMapView', () => ({ SiteMapView: () => null }));

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

it('Scan: a camera that freezes mid-recording ends the recording, keeps the clip and says so', async () => {
  const user = userEvent.setup();
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
  await user.click(record);
  clock.advance(5_000);
  track.muted = true; // jsdom has no requestVideoFrameCallback, so a muted track is the freeze signal
  expect(await screen.findByText('Camera stopped. Your clip so far is saved.', {}, { timeout: 5_000 })).toBeInTheDocument();
  expect(screen.getByRole('heading', { level: 2, name: 'Video saved' })).toBeInTheDocument();
  expect(camera.opens).toBe(opens); // the recording ended; the camera was not reopened under it
});
