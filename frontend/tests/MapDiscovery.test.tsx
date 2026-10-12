import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AppRoutes } from '../src/app/AppRoutes';
import { ServiceContainer } from '../src/app/ServiceContainer';
import { BBox } from '../src/domain/BBox';
import type { SiteMapBindings } from '../src/features/map/hooks/useSiteMap';
import type { MapView } from '../src/features/map/SiteMap';
import { BoundaryCatalog } from '../src/services/BoundaryCatalog';
import { GeoLocator } from '../src/services/GeoLocator';
import { DESKTOP_QUERY } from '../src/ui/useMediaQuery';
import { renderApp, TEST_BOUNDARY_INDEX, testServices } from './helpers';

const seen = vi.hoisted(() => ({ last: null as SiteMapBindings | null }));

// A map stand-in that records what the page asks it to draw; the tests move it by calling onViewChange.
vi.mock('../src/features/map/components/SiteMapView', () => ({
  SiteMapView: (props: SiteMapBindings) => {
    seen.last = props;
    return null;
  },
}));

// A phone's opening view just north-east of the fixture sites, with none of them inside (the live bug).
const EMPTY_VIEW = new BBox(73.06, 26.31, 73.1, 26.35);
const NEAREST = [73.0352, 26.3049]; // site_jdh_2

async function showView(view: MapView): Promise<void> {
  await waitFor(() => expect(seen.last).not.toBeNull());
  act(() => seen.last?.onViewChange(view));
}

// The few-reports card (phones) says an empty view once; closed, it stays closed for the session.
const EMPTY_CARD = 'No sites on the map here right now';
beforeEach(() => window.sessionStorage.clear());
afterEach(() => vi.unstubAllGlobals());

describe('opening view', () => {
  it("widens once to take in the pilot city's sites when the first view is empty", async () => {
    await renderApp(<AppRoutes />);
    await showView({ bbox: EMPTY_VIEW });
    await waitFor(() => expect(seen.last?.camera?.points).toContainEqual(NEAREST));
    expect(seen.last?.camera?.points[0]).toEqual(EMPTY_VIEW.center());
    // Every Jodhpur site on the map (jdh-5 was withdrawn), and nothing from outside the city.
    expect(seen.last?.camera?.points).toHaveLength(5);
    expect(seen.last?.camera?.points).not.toContainEqual([75.8156, 26.853]);
    expect(screen.queryByText('No reports here yet.')).not.toBeInTheDocument();
    // Nor does the card flash "no sites" while the map is on its way there.
    expect(screen.queryByRole('region', { name: EMPTY_CARD })).not.toBeInTheDocument();
  });

  it('leaves a view the person moved to alone: the card says it is empty, and once closed the toast offers the nearest report', async () => {
    const user = userEvent.setup();
    await renderApp(<AppRoutes />);
    await showView({ bbox: EMPTY_VIEW, byUser: true });
    const card = await screen.findByRole('region', { name: EMPTY_CARD });
    expect(seen.last?.camera).toBeNull();
    expect(screen.queryByText('No reports in this view.')).not.toBeInTheDocument();
    await user.click(within(card).getByRole('button', { name: 'Hide this tip' }));
    const status = (await screen.findByText('No reports in this view.')).closest('.map-status');
    expect(screen.queryByText('No reports here yet.')).not.toBeInTheDocument();
    await user.click(within(status as HTMLElement).getByRole('button', { name: 'Show the nearest report' }));
    expect(seen.last?.camera?.points).toEqual([NEAREST]);
  });
});

describe('empty view on desktop', () => {
  it('keeps the toast and its nearest report, where there is no card', async () => {
    const media = (query: string) => ({ matches: query === DESKTOP_QUERY, addEventListener: () => undefined, removeEventListener: () => undefined });
    vi.stubGlobal('matchMedia', media);
    await renderApp(<AppRoutes />);
    await showView({ bbox: EMPTY_VIEW, byUser: true });
    expect(await screen.findByText('No reports in this view.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Show the nearest report' })).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: EMPTY_CARD })).not.toBeInTheDocument();
  });
});

describe('opening view and location', () => {
  it('never overrides the person\'s own location fix', async () => {
    const geolocation = { getCurrentPosition: (ok: PositionCallback) => ok({ coords: { longitude: 73.08, latitude: 26.33 } } as GeolocationPosition) };
    const services = new ServiceContainer({ ...testServices(), locator: new GeoLocator(geolocation as unknown as Geolocation) });
    await renderApp(<AppRoutes />, { services });
    await userEvent.setup().click(screen.getByRole('button', { name: 'Show my location' }));
    await waitFor(() => expect(seen.last?.userLocation).toEqual([73.08, 26.33]));
    await showView({ bbox: EMPTY_VIEW });
    expect(await screen.findByRole('region', { name: EMPTY_CARD })).toBeInTheDocument();
    // "Show my location" flew there; the opening fit to Jodhpur's sites does not move the map back.
    expect(seen.last?.camera).toEqual({ points: [[73.08, 26.33]] });
  });
});

describe('Areas tab with an empty map', () => {
  it('still lists the pilot city areas from the area list route, with one empty-state line at most', async () => {
    await renderApp(<AppRoutes />, { route: '/areas' });
    await showView({ bbox: new BBox(80, 20, 80.05, 20.05), byUser: true });
    expect(await screen.findByRole('link', { name: /Sardarpura/ })).toHaveAttribute('href', '/areas/assembly/s20-ac-127');
    expect(screen.queryByText(/No reported areas yet/)).not.toBeInTheDocument();
  });
});

const LABELS = {
  type: 'FeatureCollection',
  features: [{ type: 'Feature', properties: { id: 's20-ac-125', name: 'Luni', kind: 'assembly' }, geometry: { type: 'Point', coordinates: [72.98, 26.03] } }],
};

describe('search', () => {
  const fetchFile = async (url: RequestInfo | URL) => Response.json(String(url).includes('labels') ? LABELS : TEST_BOUNDARY_INDEX);
  const withLabels = () => new ServiceContainer({ ...testServices(), boundaries: new BoundaryCatalog('/boundaries/', fetchFile) });

  it('finds a shipped seat name with no site loaded and flies to its middle', async () => {
    const user = userEvent.setup();
    await renderApp(<AppRoutes />, { services: withLabels() });
    await user.type(screen.getByRole('searchbox', { name: 'Search Jodhpur: wards, seats and places' }), 'luni');
    await user.click(await screen.findByRole('button', { name: /Luni/ }));
    expect(seen.last?.camera).toEqual({ points: [[72.98, 26.03]], zoom: 10.5 });
  });

  it('finds the seat from its Hindi spelling, and says plainly when nothing matches', async () => {
    const user = userEvent.setup();
    await renderApp(<AppRoutes />, { services: withLabels(), language: 'hi' });
    const field = screen.getByRole('searchbox', { name: 'जोधपुर में खोजें: वार्ड, क्षेत्र और जगहें' });
    await user.type(field, 'लूणी');
    // The app holds no Hindi name for the seat, so the result shows the name it has.
    await user.click(await screen.findByRole('button', { name: /Luni/ }));
    expect(seen.last?.camera).toEqual({ points: [[72.98, 26.03]], zoom: 10.5 });
    await user.type(field, 'पावटा');
    expect(await screen.findByText(/किसी इलाके का नाम लिखें/)).toBeInTheDocument();
  });
});
