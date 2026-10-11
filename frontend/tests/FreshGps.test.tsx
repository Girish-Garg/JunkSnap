import { act, screen, waitFor } from '@testing-library/react';
import userEvent, { type UserEvent } from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { AppRoutes } from '../src/app/AppRoutes';
import type { ServiceContainer } from '../src/app/ServiceContainer';
import type { GpsFix } from '../src/domain/ReportUpload';
import { CaptureFixWatch } from '../src/services/CaptureFixWatch';
import { GpsWatcher } from '../src/services/GpsWatcher';
import { ManualTimer } from './cameraFakes';
import { MemoryStore, renderApp, testServices } from './helpers';
import { FakeClock, FakeGeolocation, type SnapTestOptions } from './snapFakes';

vi.mock('../src/features/map/components/SiteMapView', () => ({ SiteMapView: () => null }));

const HERE = { lat: 26.26183, lon: 73.00352, accuracy_m: 6 };
const THERE = { lat: 26.3, lon: 73.1, accuracy_m: 4 };
const WAITING = 'Waiting for your location before the first photo.';

async function signedIn(options: Partial<SnapTestOptions>): Promise<ServiceContainer> {
  const services = testServices(new MemoryStore(), options);
  await services.auth.signUp('resident@example.com', 'jodhpur2026');
  await services.auth.confirmSignUp('resident@example.com', '123456');
  return services;
}

async function shootAndSend(user: UserEvent) {
  const shutter = screen.getByRole('button', { name: 'Take photo' });
  await waitFor(() => expect(shutter).toBeEnabled());
  await user.click(shutter);
  await user.click(await screen.findByRole('radio', { name: 'Vacant plot' }));
  await user.click(screen.getByRole('button', { name: 'Send report' }));
}

describe('Snap again', () => {
  it('waits for a new fix instead of reusing the one from the last photo', async () => {
    const user = userEvent.setup();
    const gps = new FakeGeolocation(null);
    const services = await signedIn({ geolocation: gps.api() });
    const saved = vi.spyOn(services.snap.queue, 'add');
    await renderApp(<AppRoutes />, { route: '/snap', services });
    act(() => gps.emit(HERE));
    await shootAndSend(user);
    await user.click(await screen.findByRole('button', { name: 'Report another' }));
    expect(await screen.findByText(WAITING)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Take photo' })).toBeDisabled();
    act(() => gps.emit(THERE));
    await shootAndSend(user);
    await waitFor(() => expect(saved).toHaveBeenCalledTimes(2));
    expect(saved.mock.calls.map(([draft]) => draft.gps)).toEqual([HERE, THERE]);
  });
});

describe('An old fix', () => {
  it('is refused when it arrives more than 10 s old', async () => {
    const gps = new FakeGeolocation(null);
    await renderApp(<AppRoutes />, { route: '/snap', services: await signedIn({ geolocation: gps.api() }) });
    act(() => gps.emit(HERE, 20_000));
    act(() => gps.emit(HERE, 5 * 60_000)); // a cached fix from minutes ago is old too
    expect(screen.getByText(WAITING)).toBeInTheDocument();
    act(() => gps.emit(HERE, 2_000));
    await waitFor(() => expect(screen.queryByText(WAITING)).not.toBeInTheDocument());
  });

  it('does not drop a fix that arrived fresh when a still phone gets no more, nor for a later cached one', async () => {
    const clock = new FakeClock();
    const gps = new FakeGeolocation(null);
    await renderApp(<AppRoutes />, { route: '/snap', services: await signedIn({ geolocation: gps.api(), clock }) });
    act(() => gps.emit(HERE));
    const shutter = screen.getByRole('button', { name: 'Take photo' });
    await waitFor(() => expect(shutter).toBeEnabled());
    clock.advance(30_000);
    act(() => gps.emit(THERE, 20_000));
    await new Promise((resolve) => setTimeout(resolve, 1_200));
    expect(shutter).toBeEnabled();
    expect(screen.queryByText(WAITING)).not.toBeInTheDocument();
  });
});

// CaptureFixWatch on a fake GPS, a fake clock and a timer that moves only when told.
function watching() {
  const clock = new FakeClock();
  const timer = new ManualTimer();
  const geo = new FakeGeolocation(null);
  const seen: GpsFix[] = [];
  const stop = new CaptureFixWatch(new GpsWatcher(geo.api(), clock), timer).watch({ onFix: (fix) => seen.push(fix), onProblem: () => undefined });
  return { clock, timer, geo, seen, stop };
}

describe('CaptureFixWatch', () => {
  it('passes the newest refused fix after 15 s with only old ones, so a skewed phone clock cannot hold the shutter', () => {
    const { clock, timer, geo, seen, stop } = watching();
    geo.emit(HERE, 30_000);
    geo.emit(THERE, 20_000);
    timer.advance(14_000);
    expect(seen).toEqual([]);
    timer.advance(1_000);
    expect(seen).toEqual([THERE]);
    geo.emit(HERE, 40_000); // older than the one passed on: ignored
    clock.advance(5_000);
    geo.emit(HERE, 20_000); // newer, though still old: passed on
    expect(seen).toEqual([THERE, HERE]);
    stop();
    expect(timer.pending).toBe(0);
  });

  it('never replaces a fresh fix with the fallback', () => {
    const { timer, geo, seen } = watching();
    geo.emit(HERE, 30_000);
    geo.emit(THERE, 1_000);
    timer.advance(20_000);
    expect(seen).toEqual([THERE]);
  });
});
