import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ServiceContainer } from '../src/app/ServiceContainer';
import { ToastHost } from '../src/features/actions/components/ToastHost';
import { TOAST_MS } from '../src/features/actions/hooks/useToast';
import { SitePanel } from '../src/features/site/components/SitePanel';
import { AppLocationPermission, LOCATION_EVENT } from '../src/services/AppLocationPermission';
import { BrowserLocationPermission } from '../src/services/BrowserLocationPermission';
import { GeoLocator, type PermissionQuery } from '../src/services/GeoLocator';
import { LocationAccess, type LocationPermissionSource } from '../src/services/LocationAccess';
import { FakeSiteActionsApi } from './FakeSiteActionsApi';
import { fixtureSite, MemoryStore, renderApp, testServices } from './helpers';

vi.mock('../src/features/map/components/SiteMapView', () => ({ SiteMapView: () => null }));

// site_jpr_1 is an unverified site in Jaipur; this fix is at the site.
const AT_THE_SITE = { latitude: 26.853, longitude: 75.8156, accuracy: 8 } as GeolocationCoordinates;
const PERMISSION_DENIED = 1;
const POSITION_UNAVAILABLE = 2;
const TIMEOUT = 3;

interface Waiting {
  readonly ok: PositionCallback;
  readonly fail: PositionErrorCallback;
}

/** The browser's location API as a prompt leaves it: each request waits until the test answers for the person. */
class PromptingGeolocation {
  readonly #waiting: Waiting[] = [];
  #allowed = false;
  asked = 0;

  api(): Geolocation {
    const getCurrentPosition = (ok: PositionCallback, fail?: PositionErrorCallback | null) => {
      this.asked += 1;
      if (this.#allowed) return ok({ coords: AT_THE_SITE, timestamp: Date.now() } as GeolocationPosition);
      this.#waiting.push({ ok, fail: fail ?? (() => undefined) });
    };
    return { getCurrentPosition } as unknown as Geolocation;
  }

  allow(): void {
    this.#allowed = true;
    for (const { ok } of this.#waiting.splice(0)) ok({ coords: AT_THE_SITE, timestamp: Date.now() } as GeolocationPosition);
  }

  fail(code: number): void {
    for (const { fail } of this.#waiting.splice(0)) fail({ code, message: '' } as GeolocationPositionError);
  }
}

/** navigator.permissions for geolocation: one status whose state the test sets as the person would; change() also fires its event. */
function permissions(initial: PermissionState) {
  const status = Object.assign(new EventTarget(), { state: initial });
  const change = (state: PermissionState) => {
    status.state = state;
    status.dispatchEvent(new Event('change'));
  };
  return { query: async () => status as unknown as PermissionStatus, status, change };
}

async function renderSite(geo: PromptingGeolocation, source: LocationPermissionSource, query: PermissionQuery) {
  const api = new FakeSiteActionsApi();
  const base = testServices(new MemoryStore(), { siteApi: api, geolocation: geo.api() });
  const services = new ServiceContainer({ ...base, locator: new GeoLocator(geo.api(), query), locationAccess: new LocationAccess(source) });
  await services.auth.signUp('resident@example.com', 'jodhpur2026');
  await services.auth.confirmSignUp('resident@example.com', '123456');
  const site = await fixtureSite('site_jpr_1');
  await renderApp(<><SitePanel site={site} userLocation={null} /><ToastHost /></>, { services });
  return api;
}

const tile = (name: string) => within(screen.getByRole('list', { name: 'Site actions' })).getByRole('button', { name });
const muted = (name: string) => waitFor(() => expect(tile(name)).toHaveAttribute('aria-disabled', 'true'));
const open = (name: string) => waitFor(() => expect(tile(name)).not.toHaveAttribute('aria-disabled'));
const comeBack = () => act(() => void document.dispatchEvent(new Event('visibilitychange')));
const VOTE_OFF = /Turn on location to vote here\. JunkSnap checks you're within 1 km\./;

afterEach(() => {
  vi.useRealTimers();
  delete (window as { JunkSnapAndroid?: unknown }).JunkSnapAndroid;
});

describe('location never asked yet', () => {
  it('asks only on the tap, waits while the prompt is up, then sends the vote with that fix', async () => {
    const user = userEvent.setup();
    const geo = new PromptingGeolocation();
    const query = permissions('prompt');
    const api = await renderSite(geo, new BrowserLocationPermission(query), query);
    await waitFor(() => expect(tile('Me too')).toBeEnabled());
    expect(geo.asked).toBe(0);
    await user.click(tile('Me too'));
    expect(geo.asked).toBe(1);
    await waitFor(() => expect(tile('Me too')).toBeDisabled());
    act(() => geo.allow());
    await waitFor(() => expect(api.calls).toHaveLength(1));
    expect(api.calls[0]).toMatchObject({ kind: 'vote', body: { vote: 'confirm', gps: { lat: 26.853, lon: 75.8156, accuracy_m: 8 } } });
  });
});

describe('location off or slow', () => {
  it('says the phone location is off, then that it was too slow, each with Try again that asks again', async () => {
    const user = userEvent.setup();
    const geo = new PromptingGeolocation();
    const query = permissions('prompt');
    await renderSite(geo, new BrowserLocationPermission(query), query);
    await user.click(await waitFor(() => tile('Me too')));
    act(() => geo.fail(POSITION_UNAVAILABLE));
    expect(await screen.findByText("Your phone's location is off. Turn it on and try again.")).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    expect(geo.asked).toBe(2);
    act(() => geo.fail(TIMEOUT));
    expect(await screen.findByText("Couldn't get your location. Try again.")).toBeInTheDocument();
    // Neither says location is blocked, so the tiles stay open.
    expect(tile('Me too')).not.toHaveAttribute('aria-disabled');
  });
});

describe('location blocked in a browser', () => {
  it('mutes every distance tile; a tap says why and where to allow it, and Try again asks and votes', async () => {
    const user = userEvent.setup();
    const geo = new PromptingGeolocation();
    const query = permissions('denied');
    const api = await renderSite(geo, new BrowserLocationPermission(query), query);
    await muted('Me too');
    await muted('Confirm');
    await muted('Cleaned');
    await user.click(tile('Me too'));
    expect(await screen.findByText(VOTE_OFF)).toHaveTextContent("Allow location for this site in your browser's settings, then tap Try again.");
    expect(screen.queryByRole('button', { name: 'Open app settings' })).not.toBeInTheDocument();
    expect(geo.asked).toBe(0);
    query.status.state = 'granted';
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    act(() => geo.allow());
    await waitFor(() => expect(api.calls).toEqual([expect.objectContaining({ kind: 'vote' })]));
    await open('Me too');
  });
});

describe('coming back to the page in a browser', () => {
  it('reads the permission again when the page comes back, so the tiles open without a reload', async () => {
    const geo = new PromptingGeolocation();
    const query = permissions('denied');
    await renderSite(geo, new BrowserLocationPermission(query), query);
    await muted('Me too');
    query.status.state = 'granted';
    comeBack();
    await open('Me too');
    await open('Cleaned');
  });

  it('opens the tiles at once when the person allows location while the sheet is open', async () => {
    const geo = new PromptingGeolocation();
    const query = permissions('denied');
    await renderSite(geo, new BrowserLocationPermission(query), query);
    await muted('Me too');
    act(() => query.change('granted'));
    await open('Me too');
    await open('Confirm');
    expect(geo.asked).toBe(0);
  });
});

// checkLocation answers with the app's own Android permission, as MainActivity.kt does.
function insideApp(allowed: { now: boolean }) {
  const checkLocation = vi.fn(() => window.dispatchEvent(new CustomEvent(LOCATION_EVENT, { detail: allowed.now })));
  const bridge = { print: vi.fn(), openAppSettings: vi.fn(), checkLocation };
  Object.assign(window, { JunkSnapAndroid: bridge });
  return bridge;
}

describe('location blocked inside the Android app', () => {
  it('learns the denial from the tap, mutes the tiles, offers Open app settings, and re-checks on return', async () => {
    const user = userEvent.setup();
    const allowed = { now: false };
    const bridge = insideApp(allowed);
    const geo = new PromptingGeolocation();
    // An older WebView's permissions.query says denied whatever Android decided: the app does not trust it.
    await renderSite(geo, new AppLocationPermission(window), permissions('denied'));
    await waitFor(() => expect(tile('Me too')).toBeEnabled());
    await user.click(tile('Me too'));
    act(() => geo.fail(PERMISSION_DENIED));
    expect(await screen.findByText(VOTE_OFF)).toHaveTextContent('Tap Open app settings, then Permissions, Location, Allow.');
    await muted('Me too');
    await muted('Cleaned');
    await user.click(screen.getByRole('button', { name: 'Open app settings' }));
    expect(bridge.openAppSettings).toHaveBeenCalledOnce();
    allowed.now = true;
    comeBack();
    await open('Me too');
  });
});

describe('an app build without checkLocation', () => {
  it('forgets a denial on return, so the next tap asks Android again', async () => {
    Object.assign(window, { JunkSnapAndroid: { print: vi.fn(), openAppSettings: vi.fn() } });
    const access = new LocationAccess(new AppLocationPermission(window));
    access.learn('denied');
    await access.refresh();
    expect(access.answer()).toBe('prompt');
    access.learn('timeout');
    expect(access.answer()).toBe('prompt');
  });
});

const OFF = "Your phone's location is off. Turn it on and try again.";
const OFFLINE = "You're offline. Try again once you're connected.";

// The app toast alone, on timers the test moves; withStep() shows a toast with a Try again step.
async function toasts() {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  const services = testServices();
  const run = vi.fn();
  await renderApp(<ToastHost />, { services });
  const withStep = () => act(() => services.notifier.push({ key: 'location.off', action: { key: 'snap.tryAgain', run } }));
  return { services, run, withStep, user: userEvent.setup({ advanceTimers: vi.advanceTimersByTime }) };
}

describe('a toast with a step', () => {
  it('stays, with its close button, until the next line replaces it; a plain line still leaves after TOAST_MS', async () => {
    const { services, withStep } = await toasts();
    withStep();
    act(() => vi.advanceTimersByTime(TOAST_MS * 3));
    expect(screen.getByText(OFF)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Dismiss' })).toBeInTheDocument();
    act(() => services.notifier.push({ key: 'gate.offline' }));
    expect(screen.queryByText(OFF)).not.toBeInTheDocument();
    expect(screen.getByText(OFFLINE)).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(TOAST_MS));
    expect(screen.queryByText(OFFLINE)).not.toBeInTheDocument();
  });

  it('leaves when its step is taken or it is closed', async () => {
    const { run, withStep, user } = await toasts();
    withStep();
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    expect(run).toHaveBeenCalledOnce();
    expect(screen.queryByText(OFF)).not.toBeInTheDocument();
    withStep();
    await user.click(screen.getByRole('button', { name: 'Dismiss' }));
    expect(screen.queryByText(OFF)).not.toBeInTheDocument();
    expect(run).toHaveBeenCalledOnce();
  });
});
