import { screen, within } from '@testing-library/react';
import userEvent, { type UserEvent } from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { AppRoutes } from '../src/app/AppRoutes';
import type { ServiceContainer } from '../src/app/ServiceContainer';
import type { ReportUpload } from '../src/domain/ReportUpload';
import { toHex } from '../src/domain/utils';
import { FakeReportApi } from './FakeReportApi';
import { MemoryStore, renderApp, testServices } from './helpers';
import { FakeEncoder, fixedGeolocation, type SnapTestOptions } from './snapFakes';

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

async function snapWithPhoneCamera(user: UserEvent, label = 'Use phone camera') {
  await user.upload(screen.getByLabelText(label), new File(['jpeg'], 'photo.jpg', { type: 'image/jpeg' }));
}

describe('Snap camera', () => {
  it('falls back to the phone camera when the page has no camera API', async () => {
    await renderApp(<AppRoutes />, { route: '/snap' });
    expect(screen.getByText('This page cannot open the camera here. Use the phone camera.')).toBeInTheDocument();
    expect(screen.getByText('Location ±6 m')).toBeInTheDocument();
    expect(screen.getByText('You are signed out. Photos wait on this phone until you sign in.')).toBeInTheDocument();
  });

  it('warns when the fix is worse than 30 m', async () => {
    await renderApp(<AppRoutes />, { route: '/snap', services: testServices(new MemoryStore(), { geolocation: fixedGeolocation(85) }) });
    expect(screen.getByText('Weak location ±85 m')).toBeInTheDocument();
  });
});

describe('Snap review and send', () => {
  it('needs a place before sending, then uploads and shows the checked status', async () => {
    const user = userEvent.setup();
    const api = verifiedApi();
    await renderApp(<AppRoutes />, { services: await signedIn({ api }) });
    await user.click(screen.getByRole('button', { name: 'Report' }));
    await snapWithPhoneCamera(user);
    expect(await screen.findByRole('button', { name: 'Send report' })).toBeDisabled();
    await user.click(screen.getByRole('radio', { name: 'No bin or pickup' }));
    await user.click(screen.getByRole('radio', { name: 'Waste not picked up' }));
    await user.type(screen.getByLabelText('Note (optional)'), 'Near the school gate');
    await user.click(screen.getByRole('button', { name: 'Send report' }));
    expect(await screen.findByRole('heading', { level: 2, name: 'Report saved' })).toBeInTheDocument();
    expect(await screen.findByText('Verified')).toBeInTheDocument();
    const upload = api.bodies('submit')[0] as ReportUpload;
    expect(upload).toMatchObject({ report_type: 'no_bin', context: 'no_pickup', note: 'Near the school gate', capture_mode: 'snap' });
    expect(upload.sha256).toBe(toHex(await crypto.subtle.digest('SHA-256', new FakeEncoder().bytes)));
    expect(upload.gps).toEqual({ lat: 26.26183, lon: 73.00352, accuracy_m: 6 });
  });
});

describe('Snap without location', () => {
  it('asks for location before sending when GPS is blocked', async () => {
    const user = userEvent.setup();
    const fail = (_ok: PositionCallback, onError: PositionErrorCallback) => (onError({ code: 1 } as GeolocationPositionError), 1);
    const denied = { watchPosition: fail, clearWatch: () => undefined } as unknown as Geolocation;
    await renderApp(<AppRoutes />, { route: '/snap', services: testServices(new MemoryStore(), { geolocation: denied }), language: 'hi' });
    await snapWithPhoneCamera(user, 'फ़ोन का कैमरा इस्तेमाल करें');
    await user.click(await screen.findByRole('radio', { name: 'खाली प्लॉट' }));
    expect(screen.getByText('रिपोर्ट के लिए आपकी जगह चाहिए। ब्राउज़र सेटिंग में जगह की अनुमति दें।')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'रिपोर्ट भेजें' })).toBeDisabled();
  });
});

describe('Snap queue and Activity', () => {
  it('lists the sent report in Activity with its status and site link', async () => {
    const user = userEvent.setup();
    await renderApp(<AppRoutes />, { route: '/snap', services: await signedIn({ api: verifiedApi() }) });
    await snapWithPhoneCamera(user);
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
    await snapWithPhoneCamera(user);
    await user.click(await screen.findByRole('radio', { name: 'Roadside' }));
    await user.click(screen.getByRole('button', { name: 'Send report' }));
    expect(await screen.findByText('Waiting for network')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Report another' }));
    expect(await screen.findByText('1 report waiting to send')).toBeInTheDocument();
  });
});

describe('Snap signed out', () => {
  it('holds a signed-out capture with "Sign in to send"', async () => {
    const user = userEvent.setup();
    const api = new FakeReportApi();
    await renderApp(<AppRoutes />, { route: '/snap', services: testServices(new MemoryStore(), { api }) });
    await snapWithPhoneCamera(user);
    await user.click(await screen.findByRole('radio', { name: 'Drain' }));
    await user.click(screen.getByRole('button', { name: 'Send report' }));
    expect(await screen.findByText('Sign in to send')).toBeInTheDocument();
    expect(api.calls).toEqual([]);
  });
});
