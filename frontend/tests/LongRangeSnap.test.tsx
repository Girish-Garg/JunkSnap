import { screen, waitFor } from '@testing-library/react';
import userEvent, { type UserEvent } from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { AppRoutes } from '../src/app/AppRoutes';
import type { ServiceContainer } from '../src/app/ServiceContainer';
import { GeoBearing } from '../src/domain/GeoBearing';
import type { LatLon, ReportUpload } from '../src/domain/ReportUpload';
import { FakeReportApi } from './FakeReportApi';
import { MemoryStore, renderApp, testServices } from './helpers';

vi.mock('../src/features/map/components/SiteMapView', () => ({ SiteMapView: () => null }));

// The fix the fake GPS gives (snapFakes fixedGeolocation).
const FIX = { lat: 26.26183, lon: 73.00352 };
const north = (metres: number) => GeoBearing.offset(FIX, 0, metres);

// jsdom has no WebGL, so the small map is replaced by buttons that drop the pin, as a drag or a tap would.
vi.mock('../src/features/snap/components/TargetMapView', () => ({
  TargetMapView: ({ onMove, spot }: { onMove: (point: LatLon) => void; spot: LatLon }) => (
    <div data-testid="target-map" data-spot={`${spot.lat.toFixed(5)},${spot.lon.toFixed(5)}`}>
      {[122, 450, 800].map((metres) => (
        <button key={metres} type="button" onClick={() => onMove(north(metres))}>
          {`Drop pin ${metres} m north`}
        </button>
      ))}
    </div>
  ),
}));

async function signedIn(api: FakeReportApi): Promise<ServiceContainer> {
  const services = testServices(new MemoryStore(), { api });
  await services.auth.signUp('resident@example.com', 'jodhpur2026');
  await services.auth.confirmSignUp('resident@example.com', '123456');
  return services;
}

async function review(user: UserEvent, api: FakeReportApi) {
  await renderApp(<AppRoutes />, { route: '/snap', services: await signedIn(api) });
  const shutter = await screen.findByRole('button', { name: 'Take photo' });
  await waitFor(() => expect(shutter).toBeEnabled());
  await user.click(shutter);
  await user.click(await screen.findByRole('radio', { name: 'Vacant plot' }));
}

async function send(user: UserEvent, api: FakeReportApi): Promise<ReportUpload> {
  await user.click(screen.getByRole('button', { name: 'Send report' }));
  await waitFor(() => expect(api.bodies('submit')).toHaveLength(1));
  return api.bodies('submit')[0] as ReportUpload;
}

describe('Snap long-range marking', () => {
  it('defaults to right here: no extra tap, no map and no target', async () => {
    const user = userEvent.setup();
    const api = new FakeReportApi();
    await review(user, api);
    expect(screen.getByRole('radio', { name: 'Right here' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.queryByTestId('target-map')).not.toBeInTheDocument();
    const upload = await send(user, api);
    expect(upload.target).toBeUndefined();
    expect(upload.gps).toEqual({ ...FIX, accuracy_m: 6 });
  });

  it('sends the dropped pin as the target, next to the GPS fix, and shows how far it is', async () => {
    const user = userEvent.setup();
    const api = new FakeReportApi();
    await review(user, api);
    await user.click(screen.getByRole('radio', { name: 'Farther away' }));
    expect(screen.getByText('Drag the pin, or tap the map, where the waste is.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Drop pin 122 m north' }));
    expect(screen.getByText('Waste is about 120 m from you')).toBeInTheDocument();
    const upload = await send(user, api);
    expect(upload.gps).toEqual({ ...FIX, accuracy_m: 6 });
    expect(GeoBearing.metres(FIX, upload.target ?? FIX)).toBeCloseTo(122, 0);
  });
});

describe('Snap long-range cap', () => {
  it('stops the pin at 300 m and explains the cap; up high reaches 500 m', async () => {
    const user = userEvent.setup();
    const api = new FakeReportApi();
    await review(user, api);
    await user.click(screen.getByRole('radio', { name: 'Farther away' }));
    await user.click(screen.getByRole('button', { name: 'Drop pin 450 m north' }));
    expect(screen.getByText('Waste is about 300 m from you')).toBeInTheDocument();
    expect(screen.getByText(/^The pin stops at 300 m. Mark only waste you can see clearly. On a rooftop/)).toBeInTheDocument();
    await user.click(screen.getByLabelText("I'm up high (rooftop or upper floor): reach up to 500 m"));
    await user.click(screen.getByRole('button', { name: 'Drop pin 450 m north' }));
    expect(screen.getByText('Waste is about 450 m from you')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Drop pin 800 m north' }));
    expect(screen.getByText('The pin stops at 500 m. Mark only waste you can see clearly.')).toBeInTheDocument();
    const upload = await send(user, api);
    expect(GeoBearing.metres(FIX, upload.target ?? FIX)).toBeLessThanOrEqual(500.5);
  });
});

describe('Snap long-range edges', () => {
  it('forgets the pin when the reporter goes back to right here', async () => {
    const user = userEvent.setup();
    const api = new FakeReportApi();
    await review(user, api);
    await user.click(screen.getByRole('radio', { name: 'Farther away' }));
    await user.click(screen.getByRole('button', { name: 'Drop pin 122 m north' }));
    await user.click(screen.getByRole('radio', { name: 'Right here' }));
    expect((await send(user, api)).target).toBeUndefined();
  });
});

describe('Snap long-range and no-bin', () => {
  it('never offers a long-range pin for a no-bin report', async () => {
    const user = userEvent.setup();
    const api = new FakeReportApi();
    await review(user, api);
    await user.click(screen.getByRole('radio', { name: 'Farther away' }));
    await user.click(screen.getByRole('button', { name: 'Drop pin 122 m north' }));
    await user.click(screen.getByRole('radio', { name: 'No bin or pickup' }));
    expect(screen.queryByRole('radio', { name: 'Farther away' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('radio', { name: 'Waste not picked up' }));
    expect((await send(user, api)).target).toBeUndefined();
  });

  it('shows the place step in Hindi too', async () => {
    const user = userEvent.setup();
    const api = new FakeReportApi();
    const services = await signedIn(api);
    await renderApp(<AppRoutes />, { route: '/snap', services, language: 'hi' });
    const shutter = await screen.findByRole('button', { name: 'फ़ोटो लें' });
    await waitFor(() => expect(shutter).toBeEnabled());
    await user.click(shutter);
    expect(await screen.findByRole('radio', { name: 'थोड़ा दूर' })).toBeInTheDocument();
  });
});
