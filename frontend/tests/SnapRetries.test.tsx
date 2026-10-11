import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent, { type UserEvent } from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AppRoutes } from '../src/app/AppRoutes';
import type { ServiceContainer } from '../src/app/ServiceContainer';
import type { NoBinUpload } from '../src/domain/ReportUpload';
import { FakeReportApi } from './FakeReportApi';
import { MemoryStore, renderApp, testServices } from './helpers';
import { FakeGeolocation, type SnapTestOptions } from './snapFakes';

vi.mock('../src/features/map/components/SiteMapView', () => ({ SiteMapView: () => null }));

afterEach(() => vi.restoreAllMocks());

const SAVE_FAILED = 'Could not save the report on this phone. Try again.';
const MOVED = { lat: 26.27, lon: 73.01, accuracy_m: 9 };

async function signedIn(options: Partial<SnapTestOptions> = {}): Promise<ServiceContainer> {
  const services = testServices(new MemoryStore(), options);
  await services.auth.signUp('resident@example.com', 'jodhpur2026');
  await services.auth.confirmSignUp('resident@example.com', '123456');
  return services;
}

async function shoot(user: UserEvent) {
  const shutter = await screen.findByRole('button', { name: 'Take photo' });
  await waitFor(() => expect(shutter).toBeEnabled());
  await user.click(shutter);
}

describe('No bin here, sent again after a failure', () => {
  it('keeps the same upload id, so the server makes one report, but sends where the phone is now', async () => {
    const user = userEvent.setup();
    const api = new FakeReportApi();
    api.failNext('submit', 0, 'network_error');
    const gps = new FakeGeolocation();
    await renderApp(<AppRoutes />, { route: '/snap', services: await signedIn({ api, geolocation: gps.api() }) });
    await user.click(within(screen.getByRole('group', { name: 'Capture' })).getByRole('button', { name: 'No bin here' }));
    const send = screen.getByRole('button', { name: 'There is no dustbin within 1 km of here' });
    await waitFor(() => expect(send).toBeEnabled());
    await user.click(send);
    expect(await screen.findByText('Could not send. Check your connection and try again.')).toBeInTheDocument();
    act(() => gps.emit(MOVED));
    await user.click(screen.getByRole('button', { name: 'There is no dustbin within 1 km of here' }));
    expect(await screen.findByText('Thanks. Your report joins the no-bin zone here.')).toBeInTheDocument();
    const [first, second] = api.bodies('submit') as NoBinUpload[];
    expect(second?.upload_id).toBe(first?.upload_id);
    expect(second?.gps).toEqual(MOVED);
  });
});

describe('Snap review after a failed save', () => {
  it('clears "Could not save" when the photo is retaken', async () => {
    const user = userEvent.setup();
    const services = await signedIn();
    vi.spyOn(services.snap.queue, 'add').mockRejectedValueOnce(new Error('storage full'));
    await renderApp(<AppRoutes />, { route: '/snap', services });
    await shoot(user);
    await user.click(await screen.findByRole('radio', { name: 'Vacant plot' }));
    await user.click(screen.getByRole('button', { name: 'Send report' }));
    expect(await screen.findByText(SAVE_FAILED)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Retake' }));
    await shoot(user);
    expect(await screen.findByRole('button', { name: 'Send report' })).toBeInTheDocument();
    expect(screen.queryByText(SAVE_FAILED)).not.toBeInTheDocument();
  });
});
