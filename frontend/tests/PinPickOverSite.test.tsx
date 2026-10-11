import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AppRoutes } from '../src/app/AppRoutes';
import { SheetHistory } from '../src/app/SheetHistory';
import { WorkSheets } from '../src/app/WorkSheets';
import { BBox } from '../src/domain/BBox';
import type { SiteMapBindings } from '../src/features/map/hooks/useSiteMap';
import { HistoryLayers } from '../src/ui/HistoryLayers';
import { TopLayer } from '../src/ui/TopLayer';
import { DESKTOP_QUERY } from '../src/ui/useMediaQuery';
import { MemoryStore, renderApp, testServices, type RenderOptions } from './helpers';

const seen = vi.hoisted(() => ({ last: null as SiteMapBindings | null }));

// A map stand-in: the test plays the map's part (loading a view, tapping pins and stack pins).
vi.mock('../src/features/map/components/SiteMapView', () => ({
  SiteMapView: (props: SiteMapBindings) => {
    seen.last = props;
    return null;
  },
}));

const LAYOUTS = ['phone', 'desktop'] as const;
type Layout = (typeof LAYOUTS)[number];

const OPEN_SITE = 'Waste dump'; // site_jdh_1
const STACK = ['site_jdh_2', 'site_jdh_3'] as const; // No bin or pickup, Contaminated water
const STACK_TITLE = '2 sites at this spot';
const OTHER_STACK = ['site_jdh_1', 'site_jdh_4', 'site_jpr_1'] as const;
const OTHER_STACK_TITLE = '3 sites at this spot';

const heading = (name: string) => screen.queryByRole('heading', { level: 2, name });
const layers = () => HistoryLayers.open().length;

function setLayout(layout: Layout): void {
  if (layout === 'phone') return;
  const media = (query: string) => ({ matches: query === DESKTOP_QUERY, addEventListener: () => undefined, removeEventListener: () => undefined });
  vi.stubGlobal('matchMedia', media);
}

async function loadMap(layout: Layout, options: RenderOptions): Promise<void> {
  setLayout(layout);
  await renderApp(<AppRoutes />, options);
  await waitFor(() => expect(seen.last).not.toBeNull());
  act(() => seen.last?.onViewChange({ bbox: new BBox(72.5, 26, 76, 27.2) }));
  await waitFor(() => expect(seen.last?.sites.length).toBeGreaterThan(2));
}

// The site as a shared link opens it: no entry under it.
async function openSite(layout: Layout): Promise<void> {
  await loadMap(layout, { route: '/sites/site_jdh_1' });
  expect(await screen.findByRole('heading', { level: 2, name: OPEN_SITE })).toBeInTheDocument();
}

// The site as the map opens it, in the browser's history as on Android: map, pin card, View site.
async function openSiteFromPin(layout: Layout) {
  const user = userEvent.setup();
  await loadMap(layout, { history: 'browser' });
  act(() => seen.last?.onPick('site_jdh_1'));
  await user.click(await screen.findByRole('button', { name: 'View site' }));
  expect(await screen.findByRole('button', { name: 'Close site details' })).toBeInTheDocument();
  return user;
}

// The list takes the site's place: the site's sheet is gone and the list is the only sheet over the map.
async function pickStack(): Promise<HTMLElement> {
  act(() => seen.last?.onPickStack(STACK));
  expect(await screen.findByRole('heading', { level: 2, name: STACK_TITLE })).toBeInTheDocument();
  await waitFor(() => expect(heading(OPEN_SITE)).not.toBeInTheDocument());
  expect(TopLayer.covering()).toBe(1);
  return screen.getByRole('list', { name: 'Sites at this spot' });
}

// The map with nothing open, on the app's first entry: no sheet, no depth and no layer is left to step back through.
async function expectBareMap(): Promise<void> {
  await waitFor(() => expect(window.location.pathname).toBe('/'));
  await waitFor(() => expect(layers()).toBe(0));
  expect(SheetHistory.depth((window.history.state as { usr?: unknown } | null)?.usr)).toBe(0);
  // The page follows the history a render later.
  await waitFor(() => expect(TopLayer.covering()).toBe(0));
  expect(screen.queryByRole('button', { name: 'View site' })).not.toBeInTheDocument();
}

// One press of back from there, past the app's first entry: neither the list nor a site opened earlier returns.
async function expectBackReopensNothing(): Promise<void> {
  const landed = new Promise((resolve) => window.addEventListener('popstate', resolve, { once: true }));
  await act(async () => {
    window.history.back();
    await landed;
  });
  expect(window.location.pathname).toBe('/');
  expect(TopLayer.covering()).toBe(0);
}

afterEach(() => vi.unstubAllGlobals());

// The reported bug: with a site's details open, a click on a stack pin did nothing (desktop: the list opened
// unseen under the site's sheet; phones: the tap only closed the site).
describe.each(LAYOUTS)('a stack pin picked with a site open (%s)', (layout) => {
  it('lists the sites at that spot in place of the site', async () => {
    await openSite(layout);
    const list = await pickStack();
    expect(within(list).getAllByRole('button')).toHaveLength(2);
    await waitFor(() => expect(layers()).toBe(1));
  });

  it('opens the site picked from the list in place of the list', async () => {
    const user = userEvent.setup();
    await openSite(layout);
    const list = await pickStack();
    await user.click(within(list).getByText('Contaminated water'));
    expect(await screen.findByRole('heading', { level: 2, name: 'Contaminated water' })).toBeInTheDocument();
    expect(heading(STACK_TITLE)).not.toBeInTheDocument();
    expect(heading(OPEN_SITE)).not.toBeInTheDocument();
    expect(TopLayer.covering()).toBe(1);
    expect(layers()).toBe(0);
  });
});

describe.each(LAYOUTS)('the list in place of a site (%s)', (layout) => {
  it('closes to the map with nothing open, and back from there reopens nothing', async () => {
    const user = await openSiteFromPin(layout);
    await pickStack();
    await user.click(screen.getByRole('button', { name: 'Close the list' }));
    await waitFor(() => expect(heading(STACK_TITLE)).not.toBeInTheDocument());
    await expectBareMap();
    await expectBackReopensNothing();
  });

  it('goes back to the map, not to the earlier site', async () => {
    await openSiteFromPin(layout);
    await pickStack();
    await waitFor(() => expect(layers()).toBe(1));
    act(() => window.history.back());
    await waitFor(() => expect(heading(STACK_TITLE)).not.toBeInTheDocument());
    await expectBareMap();
    expect(heading(OPEN_SITE)).not.toBeInTheDocument();
  });
});

async function openFromList(layout: Layout) {
  const user = await openSiteFromPin(layout);
  const list = await pickStack();
  await user.click(within(list).getByText('No bin or pickup'));
  expect(await screen.findByRole('heading', { level: 2, name: 'No bin or pickup' })).toBeInTheDocument();
  await waitFor(() => expect(window.location.pathname).toBe('/sites/site_jdh_2'));
  return user;
}

describe.each(LAYOUTS)('the site picked from that list (%s)', (layout) => {
  it('closes to the map with nothing open, and back from there reopens nothing', async () => {
    const user = await openFromList(layout);
    await user.click(screen.getByRole('button', { name: 'Close site details' }));
    await expectBareMap();
    await expectBackReopensNothing();
  });

  it('goes back to the map in one step: neither the list nor the earlier site comes back', async () => {
    await openFromList(layout);
    act(() => window.history.back());
    await expectBareMap();
    expect(heading('No bin or pickup')).not.toBeInTheDocument();
    expect(heading(STACK_TITLE)).not.toBeInTheDocument();
    expect(heading(OPEN_SITE)).not.toBeInTheDocument();
  });
});

// Phones already did this (SheetModel.test.tsx); desktop put a preview card on the map beside the open site.
describe.each(LAYOUTS)('a single pin picked with a site open (%s)', (layout) => {
  it('opens that site in place of the open one, and closing it ends on the map', async () => {
    const user = await openSiteFromPin(layout);
    act(() => seen.last?.onPick('site_jdh_4'));
    expect(await screen.findByRole('heading', { level: 2, name: 'Overflowing or broken bin' })).toBeInTheDocument();
    expect(heading(OPEN_SITE)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'View site' })).not.toBeInTheDocument();
    expect(layers()).toBe(0);
    await user.click(screen.getByRole('button', { name: 'Close site details' }));
    await expectBareMap();
    expect(heading(OPEN_SITE)).not.toBeInTheDocument();
  });
});

describe('the pin of the open site itself (desktop)', () => {
  it('adds no preview card of the site already in the panel', async () => {
    await openSite('desktop');
    act(() => seen.last?.onPick('site_jdh_1'));
    expect(screen.queryByRole('button', { name: 'View site' })).not.toBeInTheDocument();
    expect(heading(OPEN_SITE)).toBeInTheDocument();
    expect(layers()).toBe(0);
  });
});

async function openAreas() {
  const user = userEvent.setup();
  await loadMap('desktop', { history: 'browser' });
  await user.click(screen.getByRole('button', { name: 'Areas' }));
  expect(await screen.findByRole('heading', { level: 2, name: 'Areas' })).toBeInTheDocument();
  return user;
}

// The same cause, whatever fills the side panel: the list opened unseen under the Areas tab too.
describe('a stack pin picked with a tab open (desktop)', () => {
  it('lists its sites in place of the tab, and closing the list ends on the map', async () => {
    const user = await openAreas();
    act(() => seen.last?.onPickStack(STACK));
    expect(await screen.findByRole('heading', { level: 2, name: STACK_TITLE })).toBeInTheDocument();
    await waitFor(() => expect(heading('Areas')).not.toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: 'Close the list' }));
    await expectBareMap();
    expect(heading('Areas')).not.toBeInTheDocument();
  });

  it('takes the place of a pin card beside the tab too, with one level to go back through', async () => {
    await openAreas();
    act(() => seen.last?.onPick('site_jdh_4'));
    expect(await screen.findByRole('button', { name: 'View site' })).toBeInTheDocument();
    act(() => seen.last?.onPickStack(STACK));
    expect(await screen.findByRole('heading', { level: 2, name: STACK_TITLE })).toBeInTheDocument();
    await waitFor(() => expect(heading('Areas')).not.toBeInTheDocument());
    expect(screen.queryByRole('button', { name: 'View site' })).not.toBeInTheDocument();
    await waitFor(() => expect(layers()).toBe(1));
    act(() => window.history.back());
    await expectBareMap();
    expect(heading(STACK_TITLE)).not.toBeInTheDocument();
  });
});

// A resident whose mock session survived a reload, so the letter and cleanup sheets open without the sign-in sheet.
function signedIn() {
  const store = new MemoryStore();
  store.setItem('junksnap.session', 'resident@example.com');
  return testServices(store);
}

const WORK_ROUTES = ['/snap', '/sites/site_jdh_1/cleanup', '/sites/site_jdh_1/letter', '/areas/assembly/s20-ac-128/letter'] as const;

// A capture, a cleanup photo and a letter draft live only in their sheet, and a new draft counts against the limit.
describe('a stack pin picked with work in progress in the side panel (desktop)', () => {
  it('knows the sheets that hold work from the ones a pick may replace', () => {
    expect(WORK_ROUTES.filter((route) => WorkSheets.holds(route))).toEqual(WORK_ROUTES);
    const others = ['/', '/sites/site_jdh_1', '/areas', '/areas/assembly/s20-ac-128', '/activity', '/account', '/ranking'];
    expect(others.filter((route) => WorkSheets.holds(route))).toEqual([]);
  });

  it.each(WORK_ROUTES)('leaves %s as it is: no list, nothing closed, no history entry', async (route) => {
    await loadMap('desktop', { route, history: 'browser', services: signedIn() });
    await waitFor(() => expect(document.querySelector('.map-area > aside.sheet')).not.toBeNull());
    const sheet = document.querySelector('.map-area > aside.sheet');
    const before = { covering: TopLayer.covering(), layers: layers() };
    act(() => seen.last?.onPickStack(STACK));
    expect(heading(STACK_TITLE)).not.toBeInTheDocument();
    expect(sheet?.isConnected).toBe(true);
    expect(window.location.pathname).toBe(route);
    expect({ covering: TopLayer.covering(), layers: layers() }).toEqual(before);
  });
});

// Filters is not a route, so the list opened unseen under it, the same way it did under a site.
describe('a stack pin picked with Filters open (desktop)', () => {
  it('closes Filters and lists the sites in its place, one level over the map', async () => {
    const user = userEvent.setup();
    await loadMap('desktop', { history: 'browser' });
    await user.click(screen.getByRole('button', { name: /Filters/ }));
    expect(heading('Filters')).toBeInTheDocument();
    act(() => seen.last?.onPickStack(STACK));
    expect(await screen.findByRole('heading', { level: 2, name: STACK_TITLE })).toBeInTheDocument();
    expect(heading('Filters')).not.toBeInTheDocument();
    await waitFor(() => expect(layers()).toBe(1));
    await user.click(screen.getByRole('button', { name: 'Close the list' }));
    await expectBareMap();
  });

  it('closes Filters and the site under it too, and back from the list is the map', async () => {
    const user = await openSiteFromPin('desktop');
    await user.click(screen.getByRole('button', { name: /Filters/ }));
    expect(heading('Filters')).toBeInTheDocument();
    await pickStack();
    expect(heading('Filters')).not.toBeInTheDocument();
    await waitFor(() => expect(layers()).toBe(1));
    act(() => window.history.back());
    await expectBareMap();
    expect(heading(OPEN_SITE)).not.toBeInTheDocument();
  });
});

// With motion on, a sheet plays its closing animation before it gives its history entry back.
describe('a stack pin picked with Filters open and motion on (desktop)', () => {
  it('waits for Filters to finish closing, then lists the sites: never both, never an entry pushed mid-close', async () => {
    const user = userEvent.setup();
    await loadMap('desktop', { history: 'browser' });
    // Desktop still, and "no preference" for reduced motion: sheets animate their close (useExitAnimation).
    const media = (query: string) => ({ matches: query === DESKTOP_QUERY || query.includes('reduced-motion'), addEventListener: () => undefined, removeEventListener: () => undefined });
    vi.stubGlobal('matchMedia', media);
    await user.click(screen.getByRole('button', { name: /Filters/ }));
    const filters = heading('Filters')?.closest('aside') as HTMLElement;
    act(() => seen.last?.onPickStack(STACK));
    expect(filters).toHaveClass('sheet--closing');
    expect(heading(STACK_TITLE)).not.toBeInTheDocument();
    expect(layers()).toBe(1);
    fireEvent.animationEnd(filters);
    expect(await screen.findByRole('heading', { level: 2, name: STACK_TITLE })).toBeInTheDocument();
    expect(heading('Filters')).not.toBeInTheDocument();
    await waitFor(() => expect(layers()).toBe(1));
    expect(TopLayer.covering()).toBe(1);
  });
});

// On phones a tap on the map closes the top sheet; the map's own list gives way to the next pick instead.
describe('a pin picked with the stack list open (phone)', () => {
  async function openList(): Promise<void> {
    await loadMap('phone', { history: 'browser' });
    act(() => seen.last?.onPickStack(STACK));
    expect(await screen.findByRole('heading', { level: 2, name: STACK_TITLE })).toBeInTheDocument();
    await waitFor(() => expect(layers()).toBe(1));
  }

  it('lists another stack pin in place of the list, on the same level', async () => {
    await openList();
    act(() => seen.last?.onPickStack(OTHER_STACK));
    expect(await screen.findByRole('heading', { level: 2, name: OTHER_STACK_TITLE })).toBeInTheDocument();
    expect(heading(STACK_TITLE)).not.toBeInTheDocument();
    expect(layers()).toBe(1);
    act(() => window.history.back());
    await expectBareMap();
  });

  it('shows a single pin as its card in place of the list, as on the bare map', async () => {
    await openList();
    act(() => seen.last?.onPick('site_jdh_4'));
    expect(await screen.findByRole('button', { name: 'View site' })).toBeInTheDocument();
    expect(heading(STACK_TITLE)).not.toBeInTheDocument();
    expect(layers()).toBe(1);
    act(() => window.history.back());
    await expectBareMap();
  });
});
