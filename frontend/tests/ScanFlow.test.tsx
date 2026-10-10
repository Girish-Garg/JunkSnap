import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { AppRoutes } from '../src/app/AppRoutes';
import type { ScanSession } from '../src/domain/ScanUpload';
import { MemoryStore, renderApp, testServices } from './helpers';
import { FakeScanApi } from './scanFakes';
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

describe('Scan mode', () => {
  it('needs a place before recording, then records, sends and shows the frame reports', async () => {
    const user = userEvent.setup();
    const { services, clock, scanApi } = await signedInScan();
    await renderApp(<AppRoutes />, { route: '/snap', services });
    await user.click(screen.getByRole('button', { name: 'Video' }));
    const record = await screen.findByRole('button', { name: 'Start recording' });
    expect(record).toBeDisabled();
    await user.click(screen.getByRole('radio', { name: 'Roadside' }));
    await waitFor(() => expect(record).toBeEnabled());
    await user.click(record);
    clock.advance(5_000);
    await user.click(screen.getByRole('button', { name: 'Stop recording' }));
    expect(await screen.findByRole('heading', { level: 2, name: 'Video saved' })).toBeInTheDocument();
    expect(await screen.findByText('6 reports made from 8 frames')).toBeInTheDocument();
    const session = scanApi.bodies('submit')[0] as ScanSession;
    expect(session).toMatchObject({ report_type: 'waste_dump', context: 'roadside', duration_ms: 5000, video_key: 'scans/scn_test_1.webm' });
    expect(session.gps_track[0]).toEqual({ t_ms: 0, lat: 26.26183, lon: 73.00352, accuracy_m: 6 });
  });
});

describe('Scan in Activity', () => {
  it('lists the video in Activity with its result', async () => {
    const user = userEvent.setup();
    const { services, clock } = await signedInScan();
    await renderApp(<AppRoutes />, { route: '/snap', services });
    await user.click(screen.getByRole('button', { name: 'Video' }));
    await user.click(await screen.findByRole('radio', { name: 'Vacant plot' }));
    const record = screen.getByRole('button', { name: 'Start recording' });
    await waitFor(() => expect(record).toBeEnabled());
    await user.click(record);
    clock.advance(3_000);
    await user.click(screen.getByRole('button', { name: 'Stop recording' }));
    await screen.findByText('6 reports made from 8 frames');
    await user.click(screen.getByRole('button', { name: 'See all in Activity' }));
    const videos = await screen.findByRole('list', { name: 'Videos' });
    expect(within(videos).getByText('Video 3 s · Waste dump')).toBeInTheDocument();
    expect(within(videos).getByText('6 reports made from 8 frames')).toBeInTheDocument();
  });
});
