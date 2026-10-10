import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { AppRoutes } from '../src/app/AppRoutes';
import { ServiceContainer } from '../src/app/ServiceContainer';
import { BBox } from '../src/domain/BBox';
import type { SiteFeature } from '../src/domain/Site';
import type { SiteMapBindings } from '../src/features/map/hooks/useSiteMap';
import { renderApp, testServices } from './helpers';
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
// Newest: dump, no bin, water. Most backed: no bin, water, dump. Nearest the view's middle: no bin, dump, water.
const SITES: readonly SiteFeature[] = [
  testSite({ site_id: 'site_a', coordinates: [73.021, 26.271], last_reported_at: '2026-10-10T00:00:00Z', backers: backers(3), verification: 'unverified', location: { ward: { id: 'w1', name: 'Ward 1' } } }),
  testSite({ site_id: 'site_b', report_type: 'no_bin', coordinates: [73.04, 26.29], last_reported_at: '2026-10-05T00:00:00Z', backers: backers(10) }),
  testSite({ site_id: 'site_c', report_type: 'contaminated_water', coordinates: [73.06, 26.33], last_reported_at: '2026-10-01T00:00:00Z', backers: backers(7), verification: 'unverified' }),
  testSite({ site_id: 'site_gone', coordinates: [73.03, 26.28], status: 'cleaned' }),
];

const JODHPUR_VIEW = new BBox(72.95, 26.2, 73.1, 26.4);
const ELSEWHERE = new BBox(80, 20, 80.05, 20.05);

async function openList(view = JODHPUR_VIEW, sites = SITES) {
  const user = userEvent.setup();
  await renderApp(<AppRoutes />, { services: new ServiceContainer({ ...testServices(), api: new ListApi(sites) }) });
  await waitFor(() => expect(seen.last).not.toBeNull());
  act(() => seen.last?.onViewChange({ bbox: view, byUser: true }));
  if (view === JODHPUR_VIEW) await waitFor(() => expect(seen.last?.sites).toHaveLength(3));
  await user.click(screen.getByRole('button', { name: 'List view' }));
  return user;
}

const list = () => screen.getByRole('list', { name: 'Sites, in the order you chose' });
const rows = () => within(list()).getAllByRole('button');
const titles = () => rows().map((row) => row.querySelector('strong')?.textContent);

describe('site list', () => {
  it('lists the sites in view as compact cards, newest first without a location, never a cleaned one', async () => {
    await openList();
    expect(await screen.findByRole('heading', { level: 2, name: '3 sites in view' })).toBeInTheDocument();
    expect(titles()).toEqual(['Waste dump', 'No bin or pickup', 'Contaminated water']);
    expect(rows()[0]).toHaveTextContent('Ward 1');
    expect(rows()[0]).toHaveTextContent('Waiting · 3 of 10');
    expect(rows()[0]).toHaveTextContent('7 reports');
    expect(rows()[1]).toHaveTextContent('Verified');
  });

  it('sorts by most backed and by nearest', async () => {
    const user = await openList();
    await user.click(await screen.findByRole('button', { name: 'Most backed' }));
    expect(titles()).toEqual(['No bin or pickup', 'Contaminated water', 'Waste dump']);
    await user.click(screen.getByRole('button', { name: 'Nearest' }));
    expect(titles()).toEqual(['No bin or pickup', 'Waste dump', 'Contaminated water']);
  });
});

describe('site list controls', () => {
  it('respects the filters', async () => {
    const user = await openList();
    const sheet = await screen.findByRole('complementary', { name: '3 sites in view' });
    await user.click(within(sheet).getByRole('button', { name: 'Filters' }));
    await user.click(await screen.findByRole('switch', { name: /No bin or pickup/ }));
    expect(titles()).toEqual(['Waste dump', 'Contaminated water']);
  });

  it('moves between rows with the arrow keys, one tab stop for the list', async () => {
    const user = await openList();
    await screen.findByRole('heading', { level: 2, name: '3 sites in view' });
    expect(rows().map((row) => row.tabIndex)).toEqual([0, -1, -1]);
    rows()[0]?.focus();
    await user.keyboard('{ArrowDown}');
    expect(rows()[1]).toHaveFocus();
    await user.keyboard('{End}');
    expect(rows()[2]).toHaveFocus();
  });
});

describe('site list on the map', () => {
  it('a row flies the map to the site and opens its preview; next and previous step in list order', async () => {
    const user = await openList();
    await user.click(await within(list()).findByText('No bin or pickup'));
    expect(await screen.findByRole('region', { name: 'No bin or pickup' })).toBeInTheDocument();
    expect(seen.last?.camera?.points).toEqual([[73.04, 26.29]]);
    expect(screen.queryByRole('list', { name: 'Sites, in the order you chose' })).not.toBeInTheDocument();
    expect(screen.getByText('2 of 3')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Next site' }));
    expect(await screen.findByRole('region', { name: 'Contaminated water' })).toBeInTheDocument();
    const next = screen.getByRole('button', { name: 'Next site' });
    expect(next).toHaveAttribute('aria-disabled', 'true');
    // At the end the button keeps focus, and the step was announced with the site's type and area.
    expect(next).toHaveFocus();
    expect(screen.getByText('Contaminated water, Ward 37. 3 of 3')).toBeInTheDocument();
    await user.click(next);
    expect(screen.getByRole('region', { name: 'Contaminated water' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Previous site' }));
    await user.click(screen.getByRole('button', { name: 'Previous site' }));
    expect(await screen.findByRole('region', { name: 'Waste dump' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Previous site' })).toHaveAttribute('aria-disabled', 'true');
  });
});

describe('site list on the map, by swipe and back', () => {
  it('a sideways swipe on the card steps too', async () => {
    const user = await openList();
    await user.click(await within(list()).findByText('Waste dump'));
    const card = await screen.findByRole('region', { name: 'Waste dump' });
    const finger = { pointerId: 1, isPrimary: true, clientY: 300 };
    fireEvent.pointerDown(card, { ...finger, clientX: 300 });
    fireEvent.pointerUp(card, { ...finger, clientX: 180 });
    expect(await screen.findByRole('region', { name: 'No bin or pickup' })).toBeInTheDocument();
  });

  it('back from the card returns to the list, where a second tap on the row opens its details', async () => {
    const user = await openList();
    await user.click(await within(list()).findByText('No bin or pickup'));
    await screen.findByRole('region', { name: 'No bin or pickup' });
    await user.keyboard('{Escape}');
    const again = await within(await screen.findByRole('list', { name: 'Sites, in the order you chose' })).findByText('Tap again for details');
    await user.click(again);
    expect(await screen.findByRole('heading', { level: 2, name: 'No bin or pickup' })).toBeInTheDocument();
  });
});

describe('site list with nothing in view', () => {
  it('shows Jodhpur\'s sites instead, and "Show all of Jodhpur" fits its sites', async () => {
    const user = await openList(ELSEWHERE);
    expect(await screen.findByRole('heading', { level: 2, name: /Sites in Jodhpur/ })).toBeInTheDocument();
    expect(screen.getByText('No sites in this view')).toBeInTheDocument();
    expect(titles()).toEqual(['Waste dump', 'No bin or pickup', 'Contaminated water']);
    await user.click(screen.getByRole('button', { name: 'Show all of Jodhpur' }));
    expect(seen.last?.camera?.points).toEqual(SITES.slice(0, 3).map((site) => site.geometry.coordinates));
  });

  it('says so when there is nothing to list at all', async () => {
    const user = await openList(ELSEWHERE, []);
    expect(await screen.findByText('No sites in this view')).toBeInTheDocument();
    expect(screen.getByText(/No sites match the filters/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Show all of Jodhpur' }));
    // No site to fit: the whole city.
    expect(seen.last?.camera?.points).toEqual([[72.96, 26.22], [73.08, 26.36]]);
    expect(screen.queryByRole('list', { name: 'Sites, in the order you chose' })).not.toBeInTheDocument();
  });
});
