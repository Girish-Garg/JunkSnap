import { act, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AppRoutes } from '../src/app/AppRoutes';
import { ServiceContainer } from '../src/app/ServiceContainer';
import { BBox } from '../src/domain/BBox';
import type { SiteMapBindings } from '../src/features/map/hooks/useSiteMap';
import type { MapView } from '../src/features/map/SiteMap';
import { GeoLocator, type PermissionQuery } from '../src/services/GeoLocator';
import { DESKTOP_QUERY } from '../src/ui/useMediaQuery';
import { DEFAULTS } from './config';
import { renderApp, testServices } from './helpers';

const seen = vi.hoisted(() => ({ last: null as SiteMapBindings | null }));

vi.mock('../src/features/map/components/SiteMapView', () => ({
  SiteMapView: (props: SiteMapBindings) => {
    seen.last = props;
    return null;
  },
}));

// The phone's opening view: the middle of Jodhpur, with jdh-1 and jdh-4 in it.
const OPENING = BBox.around(DEFAULTS.pilot.centre, 0.06);
const DELHI = [77.21, 28.61] as const;

function located(state: PermissionState) {
  const getCurrentPosition = vi.fn((ok: PositionCallback) => ok({ coords: { longitude: DELHI[0], latitude: DELHI[1] } } as GeolocationPosition));
  const permissions: PermissionQuery = { query: async () => ({ state }) as PermissionStatus };
  const locator = new GeoLocator({ getCurrentPosition } as unknown as Geolocation, permissions);
  return { services: new ServiceContainer({ ...testServices(), locator }), getCurrentPosition };
}

afterEach(() => vi.unstubAllGlobals());

async function showView(view: MapView): Promise<void> {
  await waitFor(() => expect(seen.last).not.toBeNull());
  act(() => seen.last?.onViewChange(view));
}

describe('the map opens on Jodhpur', () => {
  it('stays on the pilot city with no location, showing its sites', async () => {
    await renderApp(<AppRoutes />);
    await showView({ bbox: OPENING });
    await waitFor(() => expect(seen.last?.sites.length).toBeGreaterThan(0));
    expect(seen.last?.camera).toBeNull();
    expect(seen.last?.userLocation).toBeNull();
    expect(screen.queryByRole('button', { name: 'Go to my location' })).not.toBeInTheDocument();
  });

  it('keeps Jodhpur when a location fix is elsewhere, and offers "Go to my location" instead', async () => {
    const user = userEvent.setup();
    await renderApp(<AppRoutes />, { services: located('granted').services });
    await waitFor(() => expect(seen.last?.userLocation).toEqual(DELHI));
    await showView({ bbox: OPENING });
    await waitFor(() => expect(seen.last?.sites.length).toBeGreaterThan(0));
    expect(seen.last?.camera).toBeNull();
    await user.click(await screen.findByRole('button', { name: 'Go to my location' }));
    expect(seen.last?.camera).toEqual({ points: [DELHI] });
  });
});

describe('"Go to my location" on desktop', () => {
  it('sits beside Filters, not on a line over the side panel\'s list', async () => {
    const media = (query: string) => ({ matches: query === DESKTOP_QUERY, addEventListener: () => undefined, removeEventListener: () => undefined });
    vi.stubGlobal('matchMedia', media);
    await renderApp(<AppRoutes />, { services: located('granted').services });
    await showView({ bbox: OPENING });
    const goToMe = await screen.findByRole('button', { name: 'Go to my location' });
    const filters = screen.getByRole('button', { name: /Filters/ });
    expect(goToMe.parentElement).toBe(filters.parentElement);
    expect(goToMe.parentElement).toHaveClass('search-area__row');
  });
});

describe('location and links on open', () => {
  // The map itself never asks; the app shell's one start-up fix is StartupLocation.test.tsx.
  it('never asks for location on open from the map itself', async () => {
    const { services, getCurrentPosition } = located('prompt');
    await renderApp(<AppRoutes />, { services });
    await showView({ bbox: OPENING });
    await waitFor(() => expect(seen.last?.sites.length).toBeGreaterThan(0));
    expect(getCurrentPosition).not.toHaveBeenCalled();
    expect(seen.last?.userLocation).toBeNull();
  });

  it('lets a deep link win over the opening view', async () => {
    await renderApp(<AppRoutes />, { route: '/sites/site_jdh_3' });
    await waitFor(() => expect(seen.last?.camera?.points).toEqual([[73.0458, 26.2701]]));
    // A first view that loads empty does not pull the map back to the city's sites.
    await showView({ bbox: new BBox(73.3, 26.5, 73.35, 26.55) });
    expect(await screen.findByRole('heading', { level: 2, name: 'Contaminated water' })).toBeInTheDocument();
    expect(seen.last?.camera?.points).toEqual([[73.0458, 26.2701]]);
  });
});
