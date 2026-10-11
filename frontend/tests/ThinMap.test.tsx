import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppRoutes } from '../src/app/AppRoutes';
import { ServiceContainer } from '../src/app/ServiceContainer';
import { BBox } from '../src/domain/BBox';
import type { SiteFeature } from '../src/domain/Site';
import { ThinView } from '../src/domain/ThinView';
import { FitPadding } from '../src/features/map/FitPadding';
import type { SiteMapBindings } from '../src/features/map/hooks/useSiteMap';
import { MemoryStore, renderApp, testServices } from './helpers';
import { ListApi } from './listApi';
import { testSite } from './siteBuilder';

const seen = vi.hoisted(() => ({ last: null as SiteMapBindings | null }));

// A map stand-in that records what the page asks it to draw; the tests move it by calling onViewChange.
vi.mock('../src/features/map/components/SiteMapView', () => ({
  SiteMapView: (props: SiteMapBindings) => {
    seen.last = props;
    return null;
  },
}));

const backers = (count: number) => ({ count, needed: 10, photo_people: count, vote_people: 0 });
// Waiting: the dump and the water. Nearest the middle of THREE: no bin, dump, water.
const SITES: readonly SiteFeature[] = [
  testSite({ site_id: 'site_a', coordinates: [73.021, 26.271], verification: 'unverified', backers: backers(3) }),
  testSite({ site_id: 'site_b', report_type: 'no_bin', coordinates: [73.04, 26.29] }),
  testSite({ site_id: 'site_c', report_type: 'contaminated_water', coordinates: [73.06, 26.33], verification: 'unverified', backers: backers(7) }),
];

const THREE = new BBox(72.95, 26.2, 73.1, 26.4);
const TWO = new BBox(73.0, 26.25, 73.05, 26.3);
const ONE = new BBox(73.0, 26.25, 73.03, 26.28);
// Empty, with the water site just south-west of it.
const NEAR = new BBox(73.07, 26.34, 73.1, 26.37);
const ELSEWHERE = new BBox(80, 20, 80.05, 20.05);
const NONE_CARD = 'No sites on the map here right now';
const ONE_CARD = 'Only 1 site on the map here right now';
const TWO_CARD = 'Only 2 sites on the map here right now';

function services(store = new MemoryStore()): ServiceContainer {
  return new ServiceContainer({ ...testServices(store), api: new ListApi(SITES) });
}

async function showMap(view: BBox, container = services()) {
  const user = userEvent.setup();
  await renderApp(<AppRoutes />, { services: container });
  await waitFor(() => expect(seen.last).not.toBeNull());
  act(() => seen.last?.onViewChange({ bbox: view, byUser: true }));
  return user;
}

const thinCard = () => screen.queryByRole('region', { name: /on the map here/ });
const findCard = (name: string) => screen.findByRole('region', { name });

beforeEach(() => window.sessionStorage.clear());

describe('few-reports card', () => {
  it('shows for an empty view once the search around it is done, with no Zoom out when nothing is near', async () => {
    await showMap(ELSEWHERE);
    const card = await findCard(NONE_CARD);
    expect(within(card).getByRole('button', { name: 'Report the first one' })).toBeInTheDocument();
    expect(within(card).getByRole('button', { name: 'See areas' })).toBeInTheDocument();
    expect(within(card).queryByRole('button', { name: 'Zoom out' })).not.toBeInTheDocument();
  });

  it('shows for two sites and hides for three', async () => {
    await showMap(TWO);
    expect(await findCard(TWO_CARD)).toBeInTheDocument();
    act(() => seen.last?.onViewChange({ bbox: THREE, byUser: true }));
    await waitFor(() => expect(seen.last?.sites).toHaveLength(3));
    expect(thinCard()).not.toBeInTheDocument();
  });

  it('keeps the same card through a pan that changes nothing', async () => {
    await showMap(TWO);
    const card = await findCard(TWO_CARD);
    act(() => seen.last?.onViewChange({ bbox: new BBox(73.005, 26.255, 73.055, 26.305), byUser: true }));
    // While the pan's sites load, and once they are in.
    expect(screen.getByRole('region', { name: TWO_CARD })).toBe(card);
    await act(async () => undefined);
    expect(screen.getByRole('region', { name: TWO_CARD })).toBe(card);
  });
});

describe('few-reports card over other cards', () => {
  it('hides while a pin card is open, and comes back without springing in again', async () => {
    const user = await showMap(ONE);
    expect(await findCard(ONE_CARD)).toHaveClass('thin-card--enter');
    act(() => seen.last?.onPick('site_a'));
    expect(await screen.findByRole('region', { name: 'Waste dump' })).toBeInTheDocument();
    expect(thinCard()).not.toBeInTheDocument();
    await user.keyboard('{Escape}');
    expect(await findCard(ONE_CARD)).not.toHaveClass('thin-card--enter');
  });

  it('stays dismissed for the session, and the toast says an empty view again', async () => {
    const user = await showMap(ONE);
    await user.click(within(await findCard(ONE_CARD)).getByRole('button', { name: 'Hide this tip' }));
    expect(thinCard()).not.toBeInTheDocument();
    act(() => seen.last?.onViewChange({ bbox: ELSEWHERE, byUser: true }));
    expect(await screen.findByText('No reports here yet.')).toBeInTheDocument();
    expect(thinCard()).not.toBeInTheDocument();
    expect(window.sessionStorage.getItem('junksnap.thinCard')).not.toBeNull();
  });
});

describe('few-reports card actions', () => {
  it('Report the first one asks a signed-out person to sign in first', async () => {
    const user = await showMap(ELSEWHERE);
    await user.click(await screen.findByRole('button', { name: 'Report the first one' }));
    expect(await screen.findByRole('heading', { level: 2, name: 'Sign in' })).toBeInTheDocument();
  });

  it('a report opens Snap when signed in', async () => {
    const store = new MemoryStore();
    store.setItem('junksnap.session', 'resident@example.test');
    const user = await showMap(ONE, services(store));
    await user.click(await screen.findByRole('button', { name: 'Add a report' }));
    const nav = screen.getByRole('navigation', { name: 'Main' });
    await waitFor(() => expect(within(nav).getByRole('button', { name: 'Report' })).toHaveAttribute('aria-current', 'page'));
  });

  it('See areas opens the Areas tab', async () => {
    const user = await showMap(ELSEWHERE);
    await user.click(await screen.findByRole('button', { name: 'See areas' }));
    expect(await screen.findByRole('heading', { level: 2, name: 'Areas' })).toBeInTheDocument();
  });
});

describe('few-reports card, Zoom out', () => {
  it('keeps the view, takes in the nearest site the app already found, and says it once', async () => {
    const user = await showMap(NEAR);
    const card = await findCard(NONE_CARD);
    expect(screen.queryByText('No reports in this view.')).not.toBeInTheDocument();
    await user.click(within(card).getByRole('button', { name: 'Zoom out' }));
    expect(seen.last?.camera?.points).toEqual([[73.07, 26.34], [73.1, 26.37], [73.06, 26.33]]);
    // The card stays while the map moves, then counts the view it lands on.
    expect(thinCard()).toBe(card);
    act(() => seen.last?.onViewChange({ bbox: TWO }));
    expect(await findCard(TWO_CARD)).toBe(card);
  });
});

const list = () => screen.getByRole('list', { name: 'Sites, in the order you chose' });
const titles = () => within(list()).getAllByRole('button').map((row) => row.querySelector('strong')?.textContent);

describe('list view with few sites', () => {
  it('says so under the rows, with the same actions, and the map card steps aside', async () => {
    const user = await showMap(ONE);
    await findCard(ONE_CARD);
    await user.click(screen.getByRole('button', { name: 'List view' }));
    const sheet = await screen.findByRole('complementary', { name: '1 site in view' });
    expect(within(sheet).getByText(ONE_CARD)).toBeInTheDocument();
    expect(within(sheet).getByRole('button', { name: 'Add a report' })).toBeInTheDocument();
    expect(within(sheet).getByRole('button', { name: 'See areas' })).toBeInTheDocument();
    expect(thinCard()).not.toBeInTheDocument();
  });

  it("says nothing about the view over Jodhpur's sites", async () => {
    const user = await showMap(ELSEWHERE);
    await findCard(NONE_CARD);
    await user.click(screen.getByRole('button', { name: 'List view' }));
    const sheet = await screen.findByRole('complementary', { name: /Sites in Jodhpur/ });
    expect(within(sheet).queryByText(/on the map here/)).not.toBeInTheDocument();
  });
});

describe('Needs confirming', () => {
  it('lists the waiting sites first, nearest first; a second tap goes back', async () => {
    const user = await showMap(THREE);
    await waitFor(() => expect(seen.last?.sites).toHaveLength(3));
    await user.click(screen.getByRole('button', { name: 'List view' }));
    expect(await screen.findByRole('heading', { level: 2, name: '3 sites in view' })).toBeInTheDocument();
    expect(screen.queryByText(/on the map here/)).not.toBeInTheDocument();
    const chip = screen.getByRole('button', { name: 'Needs confirming 2' });
    await user.click(chip);
    expect(chip).toHaveAttribute('aria-pressed', 'true');
    expect(titles()).toEqual(['Waste dump', 'Contaminated water', 'No bin or pickup']);
    await user.click(chip);
    expect(screen.getByRole('button', { name: 'Newest' })).toHaveAttribute('aria-pressed', 'true');
  });
});

describe('ThinView', () => {
  const view = ONE;
  const far = testSite({ site_id: 'site_far', coordinates: [80, 20] });
  it('waits for a settled view, and for the search around an empty one', () => {
    expect(ThinView.of({ view, settled: false, sites: [], known: [] })).toBeNull();
    expect(ThinView.of({ view, settled: true, sites: [], known: null })).toBeNull();
    expect(ThinView.of({ view, settled: true, sites: SITES, known: [] })).toBeNull();
    expect(ThinView.of({ view, settled: true, sites: SITES.slice(0, 2), known: [] })).toEqual({ count: 2, zoomOut: [] });
  });

  it('offers Zoom out only to a view that still loads whole', () => {
    expect(ThinView.of({ view, settled: true, sites: [], known: [far] })?.zoomOut).toEqual([]);
    expect(ThinView.of({ view, settled: true, sites: [], known: [SITES[2] as SiteFeature] })?.zoomOut).toHaveLength(3);
  });

  it("never shows the list note over Jodhpur's rows or a filtered list", () => {
    expect(ThinView.listShows({ rows: 1, fallback: true, filtered: false })).toBe(false);
    expect(ThinView.listShows({ rows: 1, fallback: false, filtered: true })).toBe(false);
  });
});

describe('FitPadding', () => {
  it('fits between the search stack and a card, and keeps 80 px without one or without room', () => {
    expect(FitPadding.between({ height: 776, stack: 110, card: 200 })).toEqual({ top: 150, bottom: 280, left: 40, right: 40 });
    expect(FitPadding.between({ height: 572, stack: 108, card: 246 })).toEqual({ top: 124, bottom: 262, left: 16, right: 16 });
    expect(FitPadding.between({ height: 776, stack: 110, card: 0 })).toBe(80);
    expect(FitPadding.between({ height: 420, stack: 110, card: 200 })).toBe(80);
  });
});
