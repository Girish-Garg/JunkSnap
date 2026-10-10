import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent, { type UserEvent } from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { AppRoutes } from '../src/app/AppRoutes';
import type { ServiceContainer } from '../src/app/ServiceContainer';
import type { ReportUpload } from '../src/domain/ReportUpload';
import { toHex } from '../src/domain/utils';
import { FakeReportApi } from './FakeReportApi';
import { MemoryStore, renderApp, testServices } from './helpers';
import { FakeEncoder, FakeGeolocation, fakeMediaDevices, fixedGeolocation, type SnapTestOptions } from './snapFakes';

vi.mock('../src/features/map/components/SiteMapView', () => ({ SiteMapView: () => null }));

async function signedIn(options: Partial<SnapTestOptions> = {}): Promise<ServiceContainer> {
  const services = testServices(new MemoryStore(), options);
  await services.auth.signUp('resident@example.com', 'jodhpur2026');
  await services.auth.confirmSignUp('resident@example.com', '123456');
  return services;
}

function verifiedApi(): FakeReportApi {
  const api = new FakeReportApi();
  api.status_ = 'verified';
  return api;
}

async function shoot(user: UserEvent, name = 'Take photo') {
  const shutter = await screen.findByRole('button', { name });
  await waitFor(() => expect(shutter).toBeEnabled());
  await user.click(shutter);
}

describe('Snap camera', () => {
  it('shows steps and a retry instead of any gallery or phone-camera fallback', async () => {
    const user = userEvent.setup();
    const media = fakeMediaDevices('NotAllowedError');
    await renderApp(<AppRoutes />, { route: '/snap', services: testServices(new MemoryStore(), { mediaDevices: media }) });
    expect(await screen.findByText('Set Camera to Allow, then tap Try again.')).toBeInTheDocument();
    expect(screen.queryByLabelText(/phone camera/i)).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    await waitFor(() => expect(media.calls).toBe(2));
  });

  it('asks for https when the page has no camera API', async () => {
    await renderApp(<AppRoutes />, { route: '/snap', services: testServices(new MemoryStore(), { mediaDevices: null }) });
    expect(screen.getByText('Open JunkSnap from its https link.')).toBeInTheDocument();
  });

  it('warns when the fix is worse than 30 m and waits for a fix before the first photo', async () => {
    await renderApp(<AppRoutes />, { route: '/snap', services: testServices(new MemoryStore(), { geolocation: fixedGeolocation(85) }) });
    expect(screen.getByText('Weak location ±85 m')).toBeInTheDocument();
    const gps = new FakeGeolocation(null);
    await renderApp(<AppRoutes />, { route: '/snap', services: testServices(new MemoryStore(), { geolocation: gps.api() }) });
    expect(screen.getByText('Waiting for your location before the first photo.')).toBeInTheDocument();
  });
});

describe('Snap review and send', () => {
  it('sends the place frozen at the shutter, not where the phone is at Send', async () => {
    const user = userEvent.setup();
    const api = verifiedApi();
    const gps = new FakeGeolocation();
    await renderApp(<AppRoutes />, { services: await signedIn({ api, geolocation: gps.api() }) });
    await user.click(screen.getByRole('button', { name: 'Report' }));
    await shoot(user);
    expect(await screen.findByRole('button', { name: 'Send report' })).toBeDisabled();
    act(() => gps.emit({ lat: 26.3, lon: 73.1, accuracy_m: 3 }));
    await user.click(screen.getByRole('radio', { name: 'No bin or pickup' }));
    await user.click(screen.getByRole('radio', { name: 'Waste not picked up' }));
    await user.type(screen.getByLabelText('Note (optional)'), 'Near the school gate');
    await user.click(screen.getByRole('button', { name: 'Send report' }));
    expect(await screen.findByText('Verified')).toBeInTheDocument();
    const upload = api.bodies('submit')[0] as ReportUpload;
    expect(upload).toMatchObject({ report_type: 'no_bin', context: 'no_pickup', note: 'Near the school gate', capture_mode: 'snap' });
    expect(upload.sha256).toBe(toHex(await crypto.subtle.digest('SHA-256', new FakeEncoder().bytes)));
    expect(upload.gps).toEqual({ lat: 26.26183, lon: 73.00352, accuracy_m: 6 });
  });
});

describe('Snap queue and Activity', () => {
  it('lists the sent report in Activity with its status and site link', async () => {
    const user = userEvent.setup();
    await renderApp(<AppRoutes />, { route: '/snap', services: await signedIn({ api: verifiedApi() }) });
    await shoot(user);
    await user.click(await screen.findByRole('radio', { name: 'Vacant plot' }));
    await user.click(screen.getByRole('button', { name: 'Send report' }));
    await screen.findByText('Verified');
    await user.click(screen.getByRole('button', { name: 'See all in Activity' }));
    const list = await screen.findByRole('list');
    expect(within(list).getByText('Waste dump')).toBeInTheDocument();
    expect(within(list).getByText('Verified')).toBeInTheDocument();
    expect(within(list).getByRole('button', { name: 'Open site' })).toBeInTheDocument();
  });

  it('keeps a report on the phone while offline and says so', async () => {
    const user = userEvent.setup();
    const api = new FakeReportApi();
    api.failNext('presign', 0, 'network_error');
    await renderApp(<AppRoutes />, { route: '/snap', services: await signedIn({ api }) });
    await shoot(user);
    await user.click(await screen.findByRole('radio', { name: 'Roadside' }));
    await user.click(screen.getByRole('button', { name: 'Send report' }));
    expect(await screen.findByText('Waiting for network')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Report another' }));
    expect(await screen.findByText('1 report waiting to send')).toBeInTheDocument();
  });
});

describe('Snap signed out', () => {
  it('holds a signed-out capture with "Sign in to send", in Hindi too', async () => {
    const user = userEvent.setup();
    const api = new FakeReportApi();
    await renderApp(<AppRoutes />, { route: '/snap', services: testServices(new MemoryStore(), { api }), language: 'hi' });
    await shoot(user, 'फ़ोटो लें');
    await user.click(await screen.findByRole('radio', { name: 'नाली' }));
    await user.click(screen.getByRole('button', { name: 'रिपोर्ट भेजें' }));
    expect(await screen.findByText('भेजने के लिए साइन इन करें')).toBeInTheDocument();
    expect(api.calls).toEqual([]);
  });
});
