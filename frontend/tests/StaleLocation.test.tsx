import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ServiceContainer } from '../src/app/ServiceContainer';
import { FreshFix } from '../src/domain/FreshFix';
import type { LonLat } from '../src/domain/Site';
import { ToastHost } from '../src/features/actions/components/ToastHost';
import { SitePanel } from '../src/features/site/components/SitePanel';
import { GeoLocator } from '../src/services/GeoLocator';
import { DEFAULTS } from './config';
import { FakeSiteActionsApi } from './FakeSiteActionsApi';
import { fixtureSite, MemoryStore, renderApp, testServices } from './helpers';
import { FakeGeolocation } from './snapFakes';

const FRESH_FIX_MS = DEFAULTS.capture.freshFixMs;

vi.mock('../src/features/map/components/SiteMapView', () => ({ SiteMapView: () => null }));

// site_jpr_1 is in Jaipur; Jodhpur is about 280 km away.
const JODHPUR: LonLat = [73.02, 26.27];
const AT_THE_SITE = { lat: 26.853, lon: 75.8156, accuracy_m: 8 };

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

/** Signed in, with the browser's location answering `fix` when the app asks for a fresh one. */
async function servicesAt(fix: { lat: number; lon: number; accuracy_m: number }, api = new FakeSiteActionsApi()): Promise<ServiceContainer> {
  const base = testServices(new MemoryStore(), { siteApi: api });
  const services = new ServiceContainer({ ...base, locator: new GeoLocator(new FakeGeolocation(fix).api()) });
  await services.auth.signUp('resident@example.com', 'jodhpur2026');
  await services.auth.confirmSignUp('resident@example.com', '123456');
  return services;
}

async function renderSite(userLocation: LonLat, services: ServiceContainer, language: 'en' | 'hi' = 'en') {
  const site = await fixtureSite('site_jpr_1');
  await renderApp(<><SitePanel site={site} userLocation={userLocation} /><ToastHost /></>, { services, language });
}

const meToo = (name = 'Me too') => within(screen.getByRole('list', { name: /Site actions|स्थल पर/ })).getByRole('button', { name });

describe('too far rests on a fresh fix', () => {
  it('takes a fresh fix on tap and says why, in Hindi, when the person is still far', async () => {
    const user = userEvent.setup();
    const api = new FakeSiteActionsApi();
    await renderSite(JODHPUR, await servicesAt({ lat: 26.27, lon: 73.02, accuracy_m: 10 }, api), 'hi');
    await waitFor(() => expect(meToo('मैंने भी देखा')).toHaveAttribute('aria-disabled', 'true'));
    await user.click(meToo('मैंने भी देखा'));
    expect(await screen.findByText('वोट केवल स्थल से 1 किमी के अंदर गिने जाते हैं। पास जाकर फिर कोशिश करें।')).toBeInTheDocument();
    expect(api.calls).toEqual([]);
  });

  it('lets the tap through when the fresh fix is in range, although the map still says far', async () => {
    const user = userEvent.setup();
    const api = new FakeSiteActionsApi();
    await renderSite(JODHPUR, await servicesAt(AT_THE_SITE, api));
    await waitFor(() => expect(meToo()).toHaveAttribute('aria-disabled', 'true'));
    await user.click(meToo());
    await waitFor(() => expect(api.calls).toEqual([expect.objectContaining({ kind: 'vote', siteId: 'site_jpr_1' })]));
    expect(screen.queryByText(/Votes count only within 1 km/)).not.toBeInTheDocument();
  });

  it('stops blocking once the map fix is more than 2 minutes old', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    await renderSite(JODHPUR, await servicesAt(AT_THE_SITE));
    await waitFor(() => expect(meToo()).toHaveAttribute('aria-disabled', 'true'));
    act(() => vi.advanceTimersByTime(FRESH_FIX_MS + 1_000));
    await waitFor(() => expect(meToo()).not.toHaveAttribute('aria-disabled'));
  });
});

describe('FreshFix', () => {
  it('measures only while under 2 minutes old', () => {
    const fix = new FreshFix(JODHPUR, 1_000, FRESH_FIX_MS);
    expect(fix.metresTo([73.02, 26.28], 1_000 + FRESH_FIX_MS - 1)).toBeCloseTo(1112, -1);
    expect(fix.metresTo([73.02, 26.28], 1_000 + FRESH_FIX_MS)).toBeNull();
    expect(fix.msLeft(1_000 + FRESH_FIX_MS + 5)).toBe(0);
  });
});
