import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { AppRoutes } from '../src/app/AppRoutes';
import type { ScanSession } from '../src/domain/ScanUpload';
import { MemoryStore, renderApp, testServices } from './helpers';
import { FakeScanApi, SAMPLE_FOUND } from './scanFakes';
import { FakeClock } from './snapFakes';

vi.mock('../src/features/map/components/SiteMapView', () => ({ SiteMapView: () => null }));

async function signedInScan() {
  const clock = new FakeClock();
  const scanApi = new FakeScanApi();
  const services = testServices(new MemoryStore(), { scanApi, clock });
  await services.auth.signUp('resident@example.com', 'jodhpur2026');
  await services.auth.confirmSignUp('resident@example.com', '123456');
  return { services, clock, scanApi };
}

async function recordFor(user: ReturnType<typeof userEvent.setup>, clock: FakeClock, ms: number) {
  const record = screen.getByRole('button', { name: 'Start recording' });
  await waitFor(() => expect(record).toBeEnabled());
  await user.click(record);
  clock.advance(ms);
  await user.click(screen.getByRole('button', { name: 'Stop recording' }));
}

describe('Scan mode', () => {
  it('starts as an area scout with an automatic place, so recording needs no pick', async () => {
    const user = userEvent.setup();
    const { services, clock, scanApi } = await signedInScan();
    await renderApp(<AppRoutes />, { route: '/snap', services });
    await user.click(screen.getByRole('button', { name: 'Video' }));
    await screen.findByRole('button', { name: 'Start recording' });
    expect(screen.getByRole('radio', { name: 'Area scout (auto)' })).toBeChecked();
    expect(screen.getByRole('radio', { name: 'Auto' })).toBeChecked();
    expect(screen.getByText(/finds dumps, overflowing bins, dirty water and open debris/)).toBeInTheDocument();
    await recordFor(user, clock, 5_000);
    expect(await screen.findByRole('heading', { level: 2, name: 'Video saved' })).toBeInTheDocument();
    expect(await screen.findByText('Found 2: 1 dump, 1 overflowing bin')).toBeInTheDocument();
    expect(screen.queryByText(/reports made/)).not.toBeInTheDocument();
    const session = scanApi.bodies('submit')[0] as ScanSession;
    expect(session).toMatchObject({ report_type: 'auto', context: 'auto', duration_ms: 5000, video_key: 'scans/scn_test_1.webm' });
    expect(session.gps_track[0]).toEqual({ t_ms: 0, lat: 26.26183, lon: 73.00352, accuracy_m: 6 });
  });

});

describe('Scan mode with a picked type', () => {
  it('keeps the specific chips: a picked type offers Auto or its own places', async () => {
    const user = userEvent.setup();
    const { services, clock, scanApi } = await signedInScan();
    await renderApp(<AppRoutes />, { route: '/snap', services });
    await user.click(screen.getByRole('button', { name: 'Video' }));
    await user.click(await screen.findByRole('radio', { name: 'Waste dump' }));
    expect(screen.getByRole('radio', { name: 'Auto' })).toBeChecked();
    await user.click(screen.getByRole('radio', { name: 'Roadside' }));
    await recordFor(user, clock, 5_000);
    await screen.findByRole('heading', { level: 2, name: 'Video saved' });
    expect(scanApi.bodies('submit')[0]).toMatchObject({ report_type: 'waste_dump', context: 'roadside' });
  });

});

describe('Scan mode for no bin', () => {
  it('asks for a place before recording no bin, which has no Auto', async () => {
    const user = userEvent.setup();
    const { services } = await signedInScan();
    await renderApp(<AppRoutes />, { route: '/snap', services });
    await user.click(screen.getByRole('button', { name: 'Video' }));
    await user.click(await screen.findByRole('radio', { name: 'No bin or pickup' }));
    expect(screen.queryByRole('radio', { name: 'Auto' })).not.toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Start recording' })).toHaveAttribute('aria-disabled', 'true'));
  });
});

describe('Scan in Activity', () => {
  it('lists the video with what it found and each frame with its result', async () => {
    const user = userEvent.setup();
    const { services, clock } = await signedInScan();
    await renderApp(<AppRoutes />, { route: '/snap', services });
    await user.click(screen.getByRole('button', { name: 'Video' }));
    await recordFor(user, clock, 3_000);
    await screen.findByText('Found 2: 1 dump, 1 overflowing bin');
    await user.click(screen.getByRole('button', { name: 'See all in Activity' }));
    const videos = await screen.findByRole('list', { name: 'Videos' });
    expect(within(videos).getByText('Video 3 s · Area scout (auto)')).toBeInTheDocument();
    expect(within(videos).getByText('Found 2: 1 dump, 1 overflowing bin')).toBeInTheDocument();
    const strip = within(videos).getByRole('list', { name: 'Frames from this video' });
    const results = within(strip).getAllByRole('listitem').map((item) => item.textContent);
    expect(results).toEqual(['Waiting for neighbours', 'Waiting for neighbours', 'Skipped', 'Added to a site', 'Not waste', 'Not waste']);
    expect(within(strip).getByRole('img', { name: 'Frame at 3 s' })).toHaveAttribute('src', SAMPLE_FOUND.frames[3]?.blurred_url);
  });
});

describe('Scan outcome lines', () => {
  it.each([
    ['nothing passed', { ...SAMPLE_FOUND, sites: 0, by_type: {}, frames: [] }, 'Nothing found in this video'],
    ['frames are still being checked', { ...SAMPLE_FOUND, sites: 0, by_type: {}, checking: 7 }, 'Checking 7 frames…'],
  ])('says so when %s, and never counts created reports', async (_case, found, text) => {
    const user = userEvent.setup();
    const { services, clock, scanApi } = await signedInScan();
    scanApi.found = found;
    await renderApp(<AppRoutes />, { route: '/snap', services });
    await user.click(screen.getByRole('button', { name: 'Video' }));
    await recordFor(user, clock, 6_000);
    expect(await screen.findByText(text)).toBeInTheDocument();
    expect(screen.queryByText(/reports made/)).not.toBeInTheDocument();
  });
});
