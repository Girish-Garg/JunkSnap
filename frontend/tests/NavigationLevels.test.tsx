import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { AppRoutes } from '../src/app/AppRoutes';
import { SheetHistory } from '../src/app/SheetHistory';
import { BBox } from '../src/domain/BBox';
import type { SiteMapBindings } from '../src/features/map/hooks/useSiteMap';
import { OnboardingPreference } from '../src/services/OnboardingPreference';
import { HistoryLayers } from '../src/ui/HistoryLayers';
import { MemoryStore, renderApp, testServices, type RenderOptions } from './helpers';

const seen = vi.hoisted(() => ({ last: null as SiteMapBindings | null }));

// A map stand-in: the test plays the map's part (loading a view, tapping pins and areas).
vi.mock('../src/features/map/components/SiteMapView', () => ({
  SiteMapView: (props: SiteMapBindings) => {
    seen.last = props;
    return null;
  },
}));

const heading = (name: string) => screen.queryByRole('heading', { level: 2, name });
const layers = () => HistoryLayers.open().length;
const JODHPUR = { kind: 'assembly', id: 's20-ac-128', name: 'Jodhpur' } as const;

async function loadMap(options: RenderOptions = {}): Promise<void> {
  await renderApp(<AppRoutes />, options);
  await waitFor(() => expect(seen.last).not.toBeNull());
  act(() => seen.last?.onViewChange({ bbox: new BBox(72.5, 26, 76, 27.2) }));
  await waitFor(() => expect(seen.last?.sites.length).toBeGreaterThan(2));
}

describe('SheetHistory trail', () => {
  it('records the path each sheet was opened from, and how far back a path is', () => {
    const areas = SheetHistory.over(null, '/');
    const area = SheetHistory.over(areas, '/areas');
    expect(area).toEqual({ depth: 2, trail: ['/', '/areas'] });
    expect(SheetHistory.stepsTo(area, '/areas')).toBe(1);
    expect(SheetHistory.stepsTo(area, '/activity')).toBe(0);
    expect(SheetHistory.replacing(area)).toEqual(area);
    // An entry from before trails (depth only) never goes back further than its depth.
    expect(SheetHistory.stepsTo({ depth: 1, trail: ['/', '/areas', '/ranking'] }, '/')).toBe(1);
  });
});

describe('the city ranking', () => {
  it('keeps its sheet level when a filter changes, so Close returns to Areas, then to the map', async () => {
    const user = userEvent.setup();
    await renderApp(<AppRoutes />);
    await user.click(screen.getByRole('button', { name: 'Areas' }));
    await user.click(await screen.findByRole('link', { name: 'City ranking' }));
    expect(await screen.findByRole('heading', { level: 2, name: 'Jodhpur ranking' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Wards' }));
    await user.click(screen.getByRole('button', { name: 'Close ranking' }));
    expect(await screen.findByRole('heading', { level: 2, name: 'Areas' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Close areas' }));
    await waitFor(() => expect(heading('Areas')).not.toBeInTheDocument());
  });

  it('"All areas" opens the list in its place when it came from the map, so back is the map', async () => {
    const user = userEvent.setup();
    await renderApp(<AppRoutes />);
    await user.click(screen.getByRole('button', { name: 'City ranking' }));
    await user.click(await screen.findByRole('link', { name: 'All areas' }));
    expect(await screen.findByRole('heading', { level: 2, name: 'Areas' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Close areas' }));
    await waitFor(() => expect(heading('Areas')).not.toBeInTheDocument());
    expect(heading('Jodhpur ranking')).not.toBeInTheDocument();
  });
});

describe('a tab tapped inside its own section', () => {
  it('goes back to the section instead of stacking a copy, so one Close reaches the map', async () => {
    const user = userEvent.setup();
    await renderApp(<AppRoutes />);
    await user.click(screen.getByRole('button', { name: 'Areas' }));
    await user.click(await screen.findByRole('link', { name: /Sardarpura/ }));
    expect(await screen.findByRole('heading', { level: 2, name: 'Sardarpura' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Areas' }));
    expect(await screen.findByRole('heading', { level: 2, name: 'Areas' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Close areas' }));
    await waitFor(() => expect(heading('Areas')).not.toBeInTheDocument());
  });
});

describe('the onboarding cards', () => {
  it('count as seen when the back button leaves them', async () => {
    const user = userEvent.setup();
    const store = new MemoryStore();
    store.setItem('junksnap.session', 'resident@example.com');
    await renderApp(<AppRoutes />, { route: '/account', services: testServices(store), history: 'browser' });
    await user.click(await screen.findByRole('button', { name: 'How JunkSnap works' }));
    expect(screen.getByRole('dialog', { name: 'How JunkSnap works' })).toBeInTheDocument();
    expect(new OnboardingPreference(store).seen()).toBe(false);
    act(() => window.history.back());
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    await waitFor(() => expect(new OnboardingPreference(store).seen()).toBe(true));
  });
});

describe('map cards share one history level', () => {
  it('a pin card that replaces an area card reuses its level, so one back closes it and leaves no entry', async () => {
    await loadMap();
    act(() => seen.last?.onPickArea(JODHPUR));
    expect(await screen.findByRole('region', { name: 'Jodhpur' })).toBeInTheDocument();
    await waitFor(() => expect(layers()).toBe(1));
    act(() => seen.last?.onPick('site_jdh_1'));
    expect(await screen.findByRole('button', { name: 'View site' })).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Jodhpur' })).not.toBeInTheDocument();
    expect(layers()).toBe(1);
    act(() => window.history.back());
    await waitFor(() => expect(screen.queryByRole('button', { name: 'View site' })).not.toBeInTheDocument());
    expect(layers()).toBe(0);
  });

  it('a stack pin unmounts the area card, so Escape closes the stack list', async () => {
    const user = userEvent.setup();
    await loadMap();
    act(() => seen.last?.onPickArea(JODHPUR));
    await screen.findByRole('region', { name: 'Jodhpur' });
    act(() => seen.last?.onPickStack(['site_jdh_1', 'site_jpr_1']));
    expect(await screen.findByRole('heading', { level: 2, name: '2 sites at this spot' })).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Jodhpur' })).not.toBeInTheDocument();
    expect(layers()).toBe(1);
    await user.keyboard('{Escape}');
    await waitFor(() => expect(heading('2 sites at this spot')).not.toBeInTheDocument());
    await waitFor(() => expect(layers()).toBe(0));
  });
});

// The browser's history, as on Android. Every stack below ends on the first entry: no sheet, no depth, and no
// layer entry left behind (a dead entry would cost an extra back press that does nothing).
async function expectFirstEntry(): Promise<void> {
  await waitFor(() => expect(window.location.pathname).toBe('/'));
  await waitFor(() => expect(layers()).toBe(0));
  expect(SheetHistory.depth((window.history.state as { usr?: unknown } | null)?.usr)).toBe(0);
}

async function openSiteFromPin(options: RenderOptions = {}) {
  const user = userEvent.setup();
  await loadMap({ ...options, history: 'browser' });
  act(() => seen.last?.onPick('site_jdh_1'));
  await user.click(await screen.findByRole('button', { name: 'View site' }));
  expect(await screen.findByRole('button', { name: 'Close site details' })).toBeInTheDocument();
  return user;
}

function signedIn() {
  const store = new MemoryStore();
  store.setItem('junksnap.session', 'resident@example.com');
  return testServices(store);
}

const areaLink = () => screen.queryAllByRole('link').find((link) => link.getAttribute('href')?.startsWith('/areas/'));

describe('sheets stacked on a site opened from a pin card', () => {
  it('Letter, Close letter, Close site', async () => {
    const user = await openSiteFromPin({ services: signedIn() });
    await user.click(await screen.findByRole('button', { name: 'Letter' }));
    await waitFor(() => expect(window.location.pathname).toMatch(/\/letter$/));
    await user.click(await screen.findByRole('button', { name: 'Close letter' }));
    await user.click(await screen.findByRole('button', { name: 'Close site details' }));
    await expectFirstEntry();
  });

  it('sign-in, back, Close site', async () => {
    const user = await openSiteFromPin();
    await user.click(await screen.findByRole('button', { name: 'Letter' }));
    expect(await screen.findByRole('heading', { level: 2, name: 'Sign in' })).toBeInTheDocument();
    act(() => window.history.back());
    await waitFor(() => expect(heading('Sign in')).not.toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: 'Close site details' }));
    await expectFirstEntry();
  });

  it('an area link, back, Close site', async () => {
    const user = await openSiteFromPin();
    await waitFor(() => expect(areaLink()).toBeDefined());
    await user.click(areaLink() as HTMLElement);
    await waitFor(() => expect(window.location.pathname).toMatch(/^\/areas\//));
    act(() => window.history.back());
    await user.click(await screen.findByRole('button', { name: 'Close site details' }));
    await expectFirstEntry();
  });
});

describe('tabs and "All areas" with the browser history', () => {
  it('the Areas tab on an area page, then Close', async () => {
    const user = userEvent.setup();
    await loadMap({ history: 'browser' });
    await user.click(screen.getByRole('button', { name: 'Areas' }));
    await user.click(await screen.findByRole('link', { name: /Sardarpura/ }));
    expect(await screen.findByRole('heading', { level: 2, name: 'Sardarpura' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Areas' }));
    await user.click(await screen.findByRole('button', { name: 'Close areas' }));
    await expectFirstEntry();
  });

  it('an area card, Open area, All areas, then Close', async () => {
    const user = userEvent.setup();
    await loadMap({ history: 'browser' });
    act(() => seen.last?.onPickArea(JODHPUR));
    await user.click(within(await screen.findByRole('region', { name: 'Jodhpur' })).getByRole('button', { name: 'Open area' }));
    await user.click(await screen.findByRole('link', { name: 'All areas' }));
    await user.click(await screen.findByRole('button', { name: 'Close areas' }));
    await expectFirstEntry();
  });
});

