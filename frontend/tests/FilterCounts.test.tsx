import { act, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AppRoutes } from '../src/app/AppRoutes';
import { BBox } from '../src/domain/BBox';
import type { SiteMapBindings } from '../src/features/map/hooks/useSiteMap';
import { renderApp, testServices } from './helpers';

const seen: { last: SiteMapBindings | null } = { last: null };

// A map stand-in: the test plays the map's part and moves the view.
vi.mock('../src/features/map/components/SiteMapView', () => ({
  SiteMapView: (props: SiteMapBindings) => {
    seen.last = props;
    return null;
  },
}));

afterEach(() => vi.restoreAllMocks());

const JODHPUR = BBox.around([73.02, 26.27], 0.2);
const JAIPUR = BBox.around([75.8156, 26.853], 0.2);
const moveTo = (bbox: BBox) => act(() => seen.last?.onViewChange({ bbox }));
const row = (name: string) => screen.getByRole('switch', { name: new RegExp(`^${name}`) });

async function openFilters(view: BBox, services = testServices()) {
  const user = userEvent.setup();
  await renderApp(<AppRoutes />, { services });
  await waitFor(() => expect(seen.last).not.toBeNull());
  moveTo(view);
  await user.click(screen.getByRole('button', { name: 'Filters' }));
  return user;
}

describe('Filters counts', () => {
  it('counts the sites in this view, says so, and leaves removed sites out', async () => {
    await openFilters(JODHPUR);
    // site_jdh_5 is a removed waste dump in this view: only site_jdh_1 counts.
    await waitFor(() => expect(row('Waste dump')).toHaveAccessibleName(/1 in view/));
    expect(row('No bin or pickup')).toHaveAccessibleName(/1 in view/);
    expect(row('Open construction')).toHaveAccessibleName(/0 in view/);
    expect(row('Verified')).toHaveAccessibleName(/4 in view/);
    expect(row('Unverified')).toHaveAccessibleName(/0 in view/);
    expect(screen.getByText(/Counts are sites in this view of the map, not totals/)).toBeInTheDocument();
  });

  it('recounts when the map moves', async () => {
    await openFilters(JODHPUR);
    await waitFor(() => expect(row('Waste dump')).toHaveAccessibleName(/1 in view/));
    moveTo(JAIPUR);
    await waitFor(() => expect(row('Open construction')).toHaveAccessibleName(/1 in view/));
    expect(row('Waste dump')).toHaveAccessibleName(/0 in view/);
    expect(row('Unverified')).toHaveAccessibleName(/1 in view/);
  });

});

describe('Filters counts with other switches and wide views', () => {
  it('counts a type only for the states still switched on', async () => {
    const user = await openFilters(JAIPUR);
    await waitFor(() => expect(row('Open construction')).toHaveAccessibleName(/1 in view/));
    await user.click(row('Unverified'));
    expect(row('Open construction')).toHaveAccessibleName(/0 in view/);
  });

  it('loads a view wider than one query in tiles, and says when only its middle is loaded', async () => {
    await openFilters(new BBox(72.5, 26, 76, 27.2));
    await waitFor(() => expect(row('Open construction')).toHaveAccessibleName(/1 in view/));
    expect(row('Waste dump')).toHaveAccessibleName(/1 in view/);
    moveTo(new BBox(68, 22, 80, 30));
    expect(await screen.findByText(/too wide to load at once/)).toBeInTheDocument();
  });

  it('shows no counts rather than zeros when the sites could not load', async () => {
    const services = testServices();
    vi.spyOn(services.api, 'listSites').mockRejectedValue(new Error('offline'));
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    await openFilters(JODHPUR, services);
    await waitFor(() => expect(row('Waste dump')).toHaveAccessibleName(/Not loaded/));
    expect(row('Verified')).toHaveAccessibleName(/Not loaded/);
  });
});
