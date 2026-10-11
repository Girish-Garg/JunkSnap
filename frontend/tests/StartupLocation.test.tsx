import { act, cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AppConfig } from '../src/app/AppConfig';
import { AppShell } from '../src/app/AppShell';
import { ServiceContainer } from '../src/app/ServiceContainer';
import { BBox } from '../src/domain/BBox';
import type { SiteMapBindings } from '../src/features/map/hooks/useSiteMap';
import { AppLocationPermission, LOCATION_EVENT } from '../src/services/AppLocationPermission';
import { BrowserLocationPermission } from '../src/services/BrowserLocationPermission';
import { GeoLocator, type PermissionQuery } from '../src/services/GeoLocator';
import { LocationAccess, type LocationPermissionSource } from '../src/services/LocationAccess';
import { LOCATION_REFUSED_KEY, StartupLocation } from '../src/services/StartupLocation';
import { StoredFlag } from '../src/services/StoredFlag';
import { DEFAULTS } from './config';
import { MemoryStore, renderApp, testServices } from './helpers';

const seen = vi.hoisted(() => ({ last: null as SiteMapBindings | null }));

vi.mock('../src/features/map/components/SiteMapView', () => ({
  SiteMapView: (props: SiteMapBindings) => {
    seen.last = props;
    return null;
  },
}));

// The phone's opening view over Jodhpur, and a person who opens the app in Delhi.
const OPENING = BBox.around(DEFAULTS.pilot.centre, 0.06);
const DELHI = [77.21, 28.61] as const;
const PERMISSION_DENIED = 1;

interface Waiting {
  readonly ok: PositionCallback;
  readonly fail: PositionErrorCallback;
}

/** navigator.geolocation: each request waits for the person's answer to the prompt, unless location is allowed. */
class PromptingGeolocation {
  readonly #waiting: Waiting[] = [];
  readonly #allowed: boolean;
  /** Every request for a fix. */
  asked = 0;
  /** Requests that waited for the person: each was a prompt on screen. */
  prompts = 0;

  constructor(allowed = false) {
    this.#allowed = allowed;
  }

  api(): Geolocation {
    const getCurrentPosition = (ok: PositionCallback, fail?: PositionErrorCallback | null) => {
      this.asked += 1;
      if (this.#allowed) return ok(PromptingGeolocation.#inDelhi());
      this.prompts += 1;
      this.#waiting.push({ ok, fail: fail ?? (() => undefined) });
    };
    return { getCurrentPosition } as unknown as Geolocation;
  }

  allow(): void {
    for (const { ok } of this.#waiting.splice(0)) ok(PromptingGeolocation.#inDelhi());
  }

  deny(): void {
    for (const { fail } of this.#waiting.splice(0)) fail({ code: PERMISSION_DENIED, message: '' } as GeolocationPositionError);
  }

  static #inDelhi(): GeolocationPosition {
    return { coords: { longitude: DELHI[0], latitude: DELHI[1], accuracy: 10 }, timestamp: Date.now() } as GeolocationPosition;
  }
}

interface Permission {
  readonly query: PermissionQuery;
  readonly source: LocationPermissionSource;
}

/** A browser whose Permissions API says `state` for geolocation. */
function browser(state: PermissionState): Permission {
  const query: PermissionQuery = { query: async () => Object.assign(new EventTarget(), { state }) as unknown as PermissionStatus };
  return { query, source: new BrowserLocationPermission(query) };
}

/** Inside the Android app: the WebView's query says prompt whatever Android decided, and checkLocation tells. */
function insideApp(allowed: boolean): Permission & { readonly checkLocation: () => void } {
  const checkLocation = vi.fn(() => void window.dispatchEvent(new CustomEvent(LOCATION_EVENT, { detail: allowed })));
  Object.assign(window, { JunkSnapAndroid: { print: vi.fn(), openAppSettings: vi.fn(), checkLocation } });
  return { query: browser('prompt').query, source: new AppLocationPermission(window), checkLocation };
}

function startServices(geo: PromptingGeolocation, permission: Permission, env: Record<string, string> = {}): ServiceContainer {
  const base = testServices(new MemoryStore());
  const locator = new GeoLocator(geo.api(), permission.query);
  return new ServiceContainer({ ...base, config: AppConfig.fromEnv(env), locator, locationAccess: new LocationAccess(permission.source) });
}

/** Opens the app as a person does, and taps the splash away. */
async function launch(services: ServiceContainer, route = '/'): Promise<void> {
  await renderApp(<AppShell />, { services, route });
  fireEvent.keyDown(window, { key: 'Enter' });
}

async function closeCards(user: ReturnType<typeof userEvent.setup>): Promise<void> {
  await screen.findByRole('dialog', { name: 'How JunkSnap works' });
  await user.click(screen.getAllByRole('button', { name: 'Skip' })[0]!);
  await waitFor(() => expect(screen.queryByRole('dialog', { name: 'How JunkSnap works' })).not.toBeInTheDocument());
}

// Lets every promise and timer behind an ask settle, so "not asked" is not just "not asked yet".
const settle = () => act(() => new Promise<void>((resolve) => setTimeout(resolve, 50)));

beforeEach(() => {
  window.sessionStorage.clear();
  window.localStorage.clear();
  seen.last = null;
});

/** A new launch of the app: session storage starts empty, local storage keeps what it had. */
async function relaunch(geo: PromptingGeolocation, permission: Permission, user: ReturnType<typeof userEvent.setup>): Promise<void> {
  cleanup();
  window.sessionStorage.clear();
  await launch(startServices(geo, permission));
  await closeCards(user);
  await settle();
}

afterEach(() => {
  delete (window as { JunkSnapAndroid?: unknown }).JunkSnapAndroid;
});

describe('location asked at start', () => {
  it('asks once the first-run cards close, never while the splash or the cards are up', async () => {
    const user = userEvent.setup();
    const geo = new PromptingGeolocation();
    await launch(startServices(geo, browser('prompt')));
    await screen.findByRole('dialog', { name: 'How JunkSnap works' });
    await settle();
    expect(geo.asked).toBe(0);
    await closeCards(user);
    await waitFor(() => expect(geo.asked).toBe(1));
    await settle();
    expect(geo.asked).toBe(1);
  });

  it('asks at most once per launch: opening the app again in the same session does not ask again', async () => {
    const user = userEvent.setup();
    const first = new PromptingGeolocation();
    await launch(startServices(first, browser('prompt')));
    await closeCards(user);
    await waitFor(() => expect(first.asked).toBe(1));
    // A reload before any answer (so no refusal is kept): the page starts over, but the session and its mark stay.
    cleanup();
    const again = new PromptingGeolocation();
    await launch(startServices(again, browser('prompt')));
    await settle();
    expect(again.asked).toBe(0);
  });
});

describe('location blocked at start', () => {
  it('takes no fix and asks nothing', async () => {
    const user = userEvent.setup();
    const geo = new PromptingGeolocation();
    await launch(startServices(geo, browser('denied')));
    await closeCards(user);
    await settle();
    expect(geo.asked).toBe(0);
  });
});

/** The first launch inside the Android app: the start asks, and the person taps "Don't allow". */
async function refuseAtStart(user: ReturnType<typeof userEvent.setup>): Promise<void> {
  const geo = new PromptingGeolocation();
  await launch(startServices(geo, insideApp(false)));
  await closeCards(user);
  await waitFor(() => expect(geo.asked).toBe(1));
  act(() => geo.deny());
  await waitFor(() => expect(window.localStorage.getItem(LOCATION_REFUSED_KEY)).not.toBeNull());
}

describe('a refusal at start inside the Android app', () => {
  it('is kept in storage: later launches never ask at start, though checkLocation cannot tell it from never asked', async () => {
    const user = userEvent.setup();
    await refuseAtStart(user);
    const second = new PromptingGeolocation();
    await relaunch(second, insideApp(false), user);
    expect(second.asked).toBe(0);
    const third = new PromptingGeolocation();
    await relaunch(third, insideApp(false), user);
    expect(third.asked).toBe(0);
  });

  it('is forgotten once Android allows location, so a later undecided launch asks again', async () => {
    const user = userEvent.setup();
    await refuseAtStart(user);
    // Allowed later (from a tap or the settings): the next start reads a quiet fix and forgets the refusal.
    const allowed = new PromptingGeolocation(true);
    await relaunch(allowed, insideApp(true), user);
    expect([allowed.asked, allowed.prompts]).toEqual([1, 0]);
    expect(window.localStorage.getItem(LOCATION_REFUSED_KEY)).toBeNull();
    // Taken back in the settings: undecided again, and no refusal is kept, so the start asks.
    const revoked = new PromptingGeolocation();
    await relaunch(revoked, insideApp(false), user);
    expect(revoked.prompts).toBe(1);
  });
});

describe('location already allowed inside the Android app', () => {
  it('takes one quiet fix after checkLocation: the dot shows, nothing prompts, and the map stays on Jodhpur', async () => {
    const user = userEvent.setup();
    const geo = new PromptingGeolocation(true);
    const app = insideApp(true);
    const services = startServices(geo, app);
    await launch(services);
    await closeCards(user);
    await waitFor(() => expect(seen.last?.userLocation).toEqual(DELHI));
    await settle();
    // The WebView's query says prompt, so the map's own quiet read never runs: this one request is the start-up fix.
    expect(app.checkLocation).toHaveBeenCalled();
    expect(geo.asked).toBe(1);
    expect(geo.prompts).toBe(0);
    expect(services.locationAccess.answer()).toBe('granted');
    act(() => seen.last?.onViewChange({ bbox: OPENING }));
    expect(await screen.findByRole('button', { name: 'Go to my location' })).toBeInTheDocument();
    expect(seen.last?.camera).toBeNull();
  });
});

describe('location already allowed in a browser', () => {
  it('reads the start-up fix quietly as well, never with a prompt', async () => {
    const user = userEvent.setup();
    const geo = new PromptingGeolocation(true);
    const services = startServices(geo, browser('granted'));
    await launch(services);
    await closeCards(user);
    await settle();
    // Two quiet reads: the map's own on open, and the start-up fix. Neither can prompt.
    expect(geo.asked).toBe(2);
    expect(geo.prompts).toBe(0);
    expect(seen.last?.userLocation).toEqual(DELHI);
    expect(services.locationAccess.answer()).toBe('granted');
  });
});

const SETTING_OFF: readonly (readonly [string, () => Permission, boolean])[] = [
  ['undecided in a browser', () => browser('prompt'), false],
  ['allowed in the Android app', () => insideApp(true), true],
];

describe('VITE_ASK_LOCATION_AT_START=false', () => {
  it.each(SETTING_OFF)('takes no fix at start when location is %s', async (_, permission, allowed) => {
    const user = userEvent.setup();
    const geo = new PromptingGeolocation(allowed);
    await launch(startServices(geo, permission(), { VITE_ASK_LOCATION_AT_START: 'false' }));
    await closeCards(user);
    await settle();
    expect(geo.asked).toBe(0);
  });
});

describe('the answer to the start-up ask', () => {
  it('shows a fix on the map but keeps it on Jodhpur, offering "Go to my location"', async () => {
    const user = userEvent.setup();
    const geo = new PromptingGeolocation();
    const services = startServices(geo, browser('prompt'));
    await launch(services);
    await closeCards(user);
    await waitFor(() => expect(geo.asked).toBe(1));
    act(() => geo.allow());
    await waitFor(() => expect(seen.last?.userLocation).toEqual(DELHI));
    act(() => seen.last?.onViewChange({ bbox: OPENING }));
    expect(await screen.findByRole('button', { name: 'Go to my location' })).toBeInTheDocument();
    expect(seen.last?.camera).toBeNull();
    expect(services.locationAccess.answer()).toBe('granted');
  });
});

describe('a denial at start inside the Android app', () => {
  const tile = (name: string) => within(screen.getByRole('list', { name: 'Site actions' })).getByRole('button', { name });

  it('says nothing at start, then the distance tiles say to allow location', async () => {
    const user = userEvent.setup();
    const geo = new PromptingGeolocation();
    const services = startServices(geo, insideApp(false));
    await services.auth.signUp('resident@example.com', 'jodhpur2026');
    await services.auth.confirmSignUp('resident@example.com', '123456');
    // A link to a site skips the first-run cards; the ask follows the splash.
    await launch(services, '/sites/site_jpr_1');
    await waitFor(() => expect(geo.asked).toBe(1));
    act(() => geo.deny());
    await waitFor(() => expect(services.locationAccess.answer()).toBe('denied'));
    await waitFor(() => expect(tile('Me too')).toHaveAttribute('aria-disabled', 'true'));
    expect(tile('Cleaned')).toHaveAttribute('aria-disabled', 'true');
    expect(screen.queryByText(/Open app settings/)).not.toBeInTheDocument();
    await user.click(tile('Me too'));
    expect(await screen.findByText(/Tap Open app settings, then Permissions, Location, Allow\./)).toBeInTheDocument();
    expect(geo.asked).toBe(1);
  });
});

// Storage the browser refuses (private mode, blocked site data): every read and write throws.
const BLOCKED = (): Storage => {
  throw new DOMException('blocked', 'SecurityError');
};

/** One launch's StartupLocation with both marks in blocked storage. */
function blockedStartup(geo: PromptingGeolocation, permission: Permission): { startup: StartupLocation; access: LocationAccess } {
  const access = new LocationAccess(permission.source);
  const startup = new StartupLocation(new GeoLocator(geo.api(), permission.query), access, StartupLocation.marks(BLOCKED, BLOCKED), true);
  return { startup, access };
}

describe('StartupLocation', () => {
  it('asks once when called twice at once (StrictMode runs effects twice), even where storage is blocked', async () => {
    const geo = new PromptingGeolocation();
    const { startup, access } = blockedStartup(geo, browser('prompt'));
    const asks = Promise.all([startup.locateOnce(), startup.locateOnce()]);
    await waitFor(() => expect(geo.asked).toBe(1));
    geo.allow();
    await asks;
    expect(startup.fix()).toEqual(DELHI);
    expect(access.answer()).toBe('granted');
  });

  it('never asks without a location API', async () => {
    const access = new LocationAccess(browser('prompt').source);
    const marks = StartupLocation.marks(() => window.sessionStorage, () => window.localStorage);
    const startup = new StartupLocation(new GeoLocator(undefined), access, marks, true);
    await startup.locateOnce();
    expect(startup.fix()).toBeNull();
    expect(access.answer()).toBe('unknown');
  });
});

describe('StartupLocation where storage is blocked', () => {
  it('keeps no refusal, so each launch asks as before', async () => {
    const launches = [new PromptingGeolocation(), new PromptingGeolocation()];
    for (const geo of launches) {
      const { startup, access } = blockedStartup(geo, insideApp(false));
      const ran = startup.locateOnce();
      await waitFor(() => expect(geo.asked).toBe(1));
      geo.deny();
      await ran;
      expect(access.answer()).toBe('denied');
    }
    expect(launches.map((geo) => geo.prompts)).toEqual([1, 1]);
  });

  it('holds no mark, and setting or clearing one never throws', () => {
    const flag = new StoredFlag('junksnap.test', BLOCKED);
    flag.set();
    flag.clear();
    expect(flag.isSet()).toBe(false);
  });
});
