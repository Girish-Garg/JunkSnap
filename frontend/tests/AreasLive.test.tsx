import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { AppRoutes } from '../src/app/AppRoutes';
import { ServiceContainer } from '../src/app/ServiceContainer';
import type { SiteMapBindings } from '../src/features/map/hooks/useSiteMap';
import type { AreaApi } from '../src/services/AreaApi';
import { renderApp, testServices } from './helpers';

const seen: { last: SiteMapBindings | null } = { last: null };

// A map stand-in that records what the page asks it to draw and lets a test tap an area.
vi.mock('../src/features/map/components/SiteMapView', () => ({
  SiteMapView: (props: SiteMapBindings) => {
    seen.last = props;
    return null;
  },
}));

const JODHPUR_SEATS = ['Bhopalgarh', 'Bilara', 'Jodhpur', 'Luni', 'Osian', 'Sardarpura', 'Shergarh', 'Soorsagar'];

// The live api today: the list route returns no rows for most of Jodhpur, because rows exist only where a site is.
function emptyLists(): ServiceContainer {
  const base = testServices();
  const areas: AreaApi = {
    scores: (kind, id) => base.areas.scores(kind, id),
    list: async (kind, within, limit) => ({ kind, within, total: 0, limit, areas: [] }),
    crawl: (districtId) => base.areas.crawl(districtId),
  };
  return new ServiceContainer({ ...base, areas });
}

const group = async (name: string) => {
  const section = (await screen.findByRole('heading', { name })).closest('section');
  if (!section) throw new Error(`No ${name} group`);
  return within(section);
};

describe('Areas tab lists every Jodhpur area', () => {
  it('shows all eight seats, both Lok Sabha seats, the district and the local body with no rows at all', async () => {
    await renderApp(<AppRoutes />, { route: '/areas', services: emptyLists() });
    const seats = await group('Assembly seats');
    expect(seats.getAllByRole('link').map((link) => link.querySelector('.area-row__name')?.textContent)).toEqual(JODHPUR_SEATS);
    const osian = seats.getByRole('link', { name: /Osian/ });
    expect(osian).toHaveAttribute('href', '/areas/assembly/s20-ac-125');
    expect(osian).toHaveTextContent('Sites: 0 · verified reports: 0');
    expect(osian).toHaveTextContent('No reports yet');
    expect((await group('Lok Sabha seats')).getAllByRole('link').map((link) => link.querySelector('.area-row__name')?.textContent)).toEqual(['Jodhpur', 'Pali']);
    expect((await group('Districts')).getByRole('link', { name: /Jodhpur/ })).toHaveTextContent('No reports yet');
    expect((await group('Local body')).getByText('Jodhpur Municipal Corporation')).toBeInTheDocument();
  });

  it('merges in the counts of the area list route and never shows a score below 10 verified reports', async () => {
    await renderApp(<AppRoutes />, { route: '/areas' });
    const seats = await group('Assembly seats');
    const sardarpura = await seats.findByRole('link', { name: /Sardarpura/ });
    expect(sardarpura).toHaveTextContent('Sites: 3 · verified reports: 4');
    expect(sardarpura).toHaveTextContent('Not enough reports yet (4 of 10 verified)');
    expect(seats.getByRole('link', { name: /Jodhpur/ })).toHaveTextContent(/Score 44 of 100 · from 14 verified reports/);
    expect(seats.getByRole('link', { name: /Bilara/ })).toHaveTextContent('No reports yet');
  });
});

describe('Area page of a Jodhpur seat with no reports', () => {
  it('names the seat and shows "No reports yet", the pilot flag and every count at 0', async () => {
    await renderApp(<AppRoutes />, { route: '/areas/assembly/s20-ac-125' });
    expect(await screen.findByRole('heading', { level: 2, name: 'Osian' })).toBeInTheDocument();
    expect(screen.getByText('Assembly seat (MLA)')).toBeInTheDocument();
    expect(screen.getByText('Pilot city')).toBeInTheDocument();
    expect(screen.getByText('No reports yet')).toBeInTheDocument();
    expect(screen.getByText('Not enough reports yet (0 of 10 verified)')).toBeInTheDocument();
    const counts = within(screen.getByRole('heading', { name: 'Counts' }).closest('section') as HTMLElement);
    expect(counts.getAllByText('0')).toHaveLength(6);
  });
});

describe('Tapping an area on the map', () => {
  it('outlines it and shows its name, counts and an Open area button', async () => {
    const user = userEvent.setup();
    await renderApp(<AppRoutes />);
    await waitFor(() => expect(seen.last).not.toBeNull());
    act(() => seen.last?.onPickArea({ kind: 'assembly', id: 's20-ac-127', name: 'Sardarpura' }));
    const card = within(await screen.findByRole('region', { name: 'Sardarpura' }));
    expect(await card.findByText('Sites: 3 · verified reports: 4')).toBeInTheDocument();
    expect(card.getByText('Not enough reports yet (4 of 10 verified)')).toBeInTheDocument();
    expect(card.getByText('Pilot city')).toBeInTheDocument();
    expect(seen.last?.focusArea).toBe('s20-ac-127');
    await user.click(card.getByRole('button', { name: 'Open area' }));
    expect(await screen.findByRole('heading', { level: 2, name: 'Sardarpura' })).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Sardarpura' })).not.toBeInTheDocument();
    expect(seen.last?.focusArea).toBe('s20-ac-127');
  });

  it('says "No reports yet" for an area nobody has reported in, and closes with its close button', async () => {
    const user = userEvent.setup();
    await renderApp(<AppRoutes />);
    await waitFor(() => expect(seen.last).not.toBeNull());
    act(() => seen.last?.onPickArea({ kind: 'assembly', id: 's20-ac-125', name: 'Osian' }));
    const card = within(await screen.findByRole('region', { name: 'Osian' }));
    expect(await card.findByText('No reports yet')).toBeInTheDocument();
    expect(card.getByText('Sites: 0 · verified reports: 0')).toBeInTheDocument();
    await user.click(card.getByRole('button', { name: 'Close area card' }));
    await waitFor(() => expect(screen.queryByRole('region', { name: 'Osian' })).not.toBeInTheDocument());
    expect(seen.last?.focusArea).toBeNull();
  });
});
