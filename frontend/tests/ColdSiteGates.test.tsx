import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactElement } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AppRoutes } from '../src/app/AppRoutes';
import { ServiceContainer } from '../src/app/ServiceContainer';
import { ToastHost } from '../src/features/actions/components/ToastHost';
import { SitePreviewCard } from '../src/features/site/components/SitePreviewCard';
import { GeoLocator } from '../src/services/GeoLocator';
import { MockAuthService } from '../src/services/MockAuthService';
import { listed } from './activityRig';
import { DEFAULTS } from './config';
import { FakeReportApi } from './FakeReportApi';
import { FakeSiteActionsApi } from './FakeSiteActionsApi';
import { findEnabledButton, fixtureSite, MemoryStore, renderApp, testServices } from './helpers';

vi.mock('../src/features/map/components/SiteMapView', () => ({ SiteMapView: () => null }));

// site_jpr_1 is an unverified site in Jaipur: Confirm is its primary tile and its vote box shows at once.
const SITE = '/sites/site_jpr_1';
const OWN_SITE = 'You reported this site, so your vote is not counted here.';
// The line under the site's action tiles.
const NOTE = '.action-row__note';
const { checkLimitMs: CHECK_LIMIT_MS } = DEFAULTS.ui;
const { freshFixMs: FRESH_FIX_MS } = DEFAULTS.capture;

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

interface Options {
  readonly reports?: FakeReportApi;
  readonly sites?: FakeSiteActionsApi;
  readonly locator?: GeoLocator;
}

async function signedIn(options: Options = {}): Promise<ServiceContainer> {
  const base = testServices(new MemoryStore(), { api: options.reports, siteApi: options.sites ?? new FakeSiteActionsApi() });
  const services = options.locator ? new ServiceContainer({ ...base, locator: options.locator }) : base;
  await services.auth.signUp('resident@example.com', 'jodhpur2026');
  await services.auth.confirmSignUp('resident@example.com', '123456');
  return services;
}

const withToasts = (ui: ReactElement) => (
  <>
    {ui}
    <ToastHost />
  </>
);
const tile = (name: string) => within(screen.getByRole('list', { name: 'Site actions' })).getByRole('button', { name });
const looksOpen = (button: HTMLElement) => !(button as HTMLButtonElement).disabled && button.getAttribute('aria-disabled') !== 'true';

// Every state Confirm shows while the sheet lives, so a test can prove it never looked open in between.
function watchConfirm(): { readonly openSeen: () => boolean } {
  let open = false;
  const look = () => {
    const confirm = screen.queryByRole('button', { name: 'Confirm' });
    if (confirm && looksOpen(confirm)) open = true;
  };
  const observer = new MutationObserver(look);
  observer.observe(document.body, { subtree: true, childList: true, attributes: true });
  return { openSeen: () => open };
}

interface SlowLocator {
  readonly locator: GeoLocator;
  readonly arrive: (lon: number, lat: number) => void;
  /** Fixes asked for and not answered yet. */
  readonly asked: () => number;
}

// Location is allowed, and a fix arrives only when the test says so, as on a phone's cold GPS.
function slowLocator(): SlowLocator {
  const waiting: PositionCallback[] = [];
  const geolocation = { getCurrentPosition: (onFix: PositionCallback) => waiting.push(onFix) } as unknown as Geolocation;
  const permissions = { query: async () => ({ state: 'granted' }) as PermissionStatus };
  const arrive = (lon: number, lat: number) => {
    const coords = { latitude: lat, longitude: lon, accuracy: 8 } as GeolocationCoordinates;
    for (const onFix of waiting.splice(0)) onFix({ coords, timestamp: Date.now() } as GeolocationPosition);
  };
  return { locator: new GeoLocator(geolocation, permissions), arrive, asked: () => waiting.length };
}

describe('a cold link to a site the person reported from another phone', () => {
  it('says "Checking…" while their reports load, then shows "You reported this site", never open in between', async () => {
    const user = userEvent.setup();
    const reports = new FakeReportApi();
    reports.pages_ = [[{ ...listed(4), site_id: 'site_jpr_1' }]];
    const release = reports.holdList();
    const sites = new FakeSiteActionsApi();
    const watch = watchConfirm();
    await renderApp(withToasts(<AppRoutes />), { route: SITE, services: await signedIn({ reports, sites }) });
    expect(await screen.findByText('Checking…', { selector: NOTE })).toBeInTheDocument();
    expect(tile('Confirm')).toBeDisabled();
    expect(tile('Me too')).toBeDisabled();
    act(release);
    await waitFor(() => expect(tile('Confirm')).toHaveAttribute('aria-disabled', 'true'));
    expect(tile('Me too')).toHaveAttribute('aria-disabled', 'true');
    expect(screen.queryByText('Checking…', { selector: NOTE })).not.toBeInTheDocument();
    await user.click(tile('Confirm'));
    expect(await screen.findByText(OWN_SITE)).toBeInTheDocument();
    expect(watch.openSeen()).toBe(false);
    expect(sites.calls).toEqual([]);
  });
});

describe('a cold link before the first location fix', () => {
  it('keeps Confirm plainly disabled and waiting, then opens it once the fix is in range', async () => {
    const { locator, arrive } = slowLocator();
    const services = await signedIn({ locator });
    await renderApp(<AppRoutes />, { route: SITE, services });
    expect(await screen.findByText('Checking…', { selector: NOTE })).toBeInTheDocument();
    // The person's reports are in (none here), so only the fix holds Confirm now.
    await waitFor(() => expect(services.snap.activity.state().loading).toBe(false));
    const confirm = tile('Confirm');
    expect(confirm).toBeDisabled();
    expect(confirm).not.toHaveAttribute('aria-disabled');
    act(() => arrive(75.8156, 26.853));
    await waitFor(() => expect(tile('Confirm')).toBeEnabled());
    expect(tile('Confirm')).not.toHaveAttribute('aria-disabled');
  });

  it('gives the pin card the same wait for its Add a photo button', async () => {
    const { locator, arrive } = slowLocator();
    const services = await signedIn({ locator });
    const site = await fixtureSite('site_jpr_1');
    await renderApp(<SitePreviewCard site={site} userLocation={null} onDetails={() => undefined} onClose={() => undefined} />, { services });
    expect(screen.getByRole('button', { name: 'Add a photo' })).toBeDisabled();
    act(() => arrive(75.8156, 26.853));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Add a photo' })).toBeEnabled());
  });
});

describe('a 403 own_site from the api', () => {
  it('turns the vote tiles muted with the reason at once, and they stay muted when the sheet opens again', async () => {
    const user = userEvent.setup();
    const sites = new FakeSiteActionsApi();
    sites.failNext('vote', 403, 'own_site');
    const services = await signedIn({ sites });
    const { unmount } = await renderApp(withToasts(<AppRoutes />), { route: SITE, services });
    await waitFor(() => expect(tile('Me too')).toBeEnabled());
    await user.click(tile('Me too'));
    await waitFor(() => expect(tile('Me too')).toHaveAttribute('aria-disabled', 'true'));
    expect(tile('Confirm')).toHaveAttribute('aria-disabled', 'true');
    expect(screen.getByText(OWN_SITE)).toBeInTheDocument();
    unmount();
    const watch = watchConfirm();
    await renderApp(withToasts(<AppRoutes />), { route: SITE, services });
    await waitFor(() => expect(tile('Confirm')).toHaveAttribute('aria-disabled', 'true'));
    await user.click(tile('Confirm'));
    expect(await screen.findByText(OWN_SITE)).toBeInTheDocument();
    expect(watch.openSeen()).toBe(false);
    expect(sites.calls).toHaveLength(1);
  });
});

// Vitest hands CSS imports back empty, so the stylesheet is read from disk (the app has no Node types).
type FileReader = { readFileSync(path: string, encoding: 'utf8'): string };
const fs = (await import('node:fs' as string)) as FileReader;
const sheetCss = fs.readFileSync('src/ui/sheet.css', 'utf8');

describe('the foot of a sheet over the map', () => {
  it('stops above the raised Report button on phones, so the line under the actions stays readable', async () => {
    // Phones and tablets: the sheet's body ends --map-foot (the Report overhang and a gap) above the nav bar.
    const phones = /@media \(max-width: 1023px\) \{\s*\.map-area > \.sheet \{([^}]*)\}/.exec(sheetCss)?.[1] ?? '';
    expect(phones).toContain('padding-bottom: var(--map-foot);');
    // The site sheet is that sheet: a direct child of the map area.
    await renderApp(<AppRoutes />, { route: SITE });
    await screen.findByRole('list', { name: 'Site actions' });
    expect(document.querySelector(NOTE)?.closest('.map-area > .sheet')).not.toBeNull();
  });
});

// A short wait is never a stuck one: each thing it waits on lets go by itself.
describe('a check that cannot finish', () => {
  it('stops waiting on a list that never comes after CHECK_LIMIT_MS, and the api decides', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const reports = new FakeReportApi();
    reports.holdList();
    await renderApp(<AppRoutes />, { route: SITE, services: await signedIn({ reports }) });
    expect(await screen.findByText('Checking…', { selector: NOTE })).toBeInTheDocument();
    expect(tile('Confirm')).toBeDisabled();
    act(() => vi.advanceTimersByTime(CHECK_LIMIT_MS));
    await waitFor(() => expect(tile('Confirm')).toBeEnabled());
    expect(tile('Confirm')).not.toHaveAttribute('aria-disabled');
  });

  it('stops waiting when the list fails, and does not ask again at every open', async () => {
    const reports = new FakeReportApi();
    reports.failNext('mine', 503, 'server_error');
    const services = await signedIn({ reports });
    const { unmount } = await renderApp(<AppRoutes />, { route: SITE, services });
    await waitFor(() => expect(tile('Confirm')).toBeEnabled());
    unmount();
    await renderApp(<AppRoutes />, { route: SITE, services });
    await waitFor(() => expect(tile('Confirm')).toBeEnabled());
    expect(reports.count('mine')).toBe(1);
  });
});

describe('a saved sign-in that is slow to read', () => {
  it('treats a saved sign-in still unread after CHECK_LIMIT_MS as signed out: Confirm opens sign-in', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    // A token refresh that never answers: the session stays "restoring".
    const auth = new (class extends MockAuthService {
      override restoring(): boolean {
        return true;
      }
    })(new MemoryStore(), 0);
    await renderApp(<AppRoutes />, { route: SITE, services: testServices(new MemoryStore(), { auth }) });
    expect(await screen.findByText('Checking…', { selector: NOTE })).toBeInTheDocument();
    expect(tile('Confirm')).toBeDisabled();
    act(() => vi.advanceTimersByTime(CHECK_LIMIT_MS));
    await waitFor(() => expect(tile('Confirm')).toBeEnabled());
    expect(tile('Confirm')).not.toHaveAttribute('aria-disabled');
    await user.click(tile('Confirm'));
    expect(await screen.findByText('Sign in to vote.')).toBeInTheDocument();
  });
});

describe('a fix that gets stale', () => {
  it('keeps Confirm open while it is read again quietly', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const { locator, arrive, asked } = slowLocator();
    await renderApp(<AppRoutes />, { route: SITE, services: await signedIn({ locator }) });
    await screen.findByRole('list', { name: 'Site actions' });
    act(() => arrive(75.8156, 26.853));
    await waitFor(() => expect(tile('Confirm')).toBeEnabled());
    act(() => vi.advanceTimersByTime(FRESH_FIX_MS + 1_000));
    await waitFor(() => expect(asked()).toBeGreaterThan(0));
    expect(tile('Confirm')).toBeEnabled();
    expect(screen.queryByText('Checking…', { selector: NOTE })).not.toBeInTheDocument();
  });
});

describe('what a 403 own_site taught', () => {
  it('is forgotten when the account changes, so the next person can vote there', async () => {
    const user = userEvent.setup();
    const sites = new FakeSiteActionsApi();
    sites.failNext('vote', 403, 'own_site');
    const services = await signedIn({ sites });
    await renderApp(<AppRoutes />, { route: SITE, services });
    await user.click(await findEnabledButton('Me too'));
    await waitFor(() => expect(tile('Confirm')).toHaveAttribute('aria-disabled', 'true'));
    await act(() => services.auth.signOut());
    await act(async () => {
      await services.auth.signUp('neighbour@example.com', 'jodhpur2026');
      await services.auth.confirmSignUp('neighbour@example.com', '123456');
    });
    await waitFor(() => expect(tile('Confirm')).toBeEnabled());
    expect(tile('Confirm')).not.toHaveAttribute('aria-disabled');
  });
});
