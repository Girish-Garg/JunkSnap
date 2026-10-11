import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AppRoutes } from '../src/app/AppRoutes';
import { SheetHistory } from '../src/app/SheetHistory';
import { BBox } from '../src/domain/BBox';
import type { SiteMapBindings } from '../src/features/map/hooks/useSiteMap';
import { HistoryLayers } from '../src/ui/HistoryLayers';
import { TopLayer } from '../src/ui/TopLayer';
import { DESKTOP_QUERY } from '../src/ui/useMediaQuery';
import { renderApp, type RenderOptions } from './helpers';

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
