import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { AppRoutes } from '../src/app/AppRoutes';
import { BBox } from '../src/domain/BBox';
import type { SiteMapBindings } from '../src/features/map/hooks/useSiteMap';
import { renderApp } from './helpers';

const seen: { last: SiteMapBindings | null } = { last: null };

// A map stand-in: the test plays the map's part, loading a view and tapping a stack pin.
vi.mock('../src/features/map/components/SiteMapView', () => ({
  SiteMapView: (props: SiteMapBindings) => {
    seen.last = props;
    return null;
  },
}));

async function openStack(siteIds: readonly string[]): Promise<void> {
  await renderApp(<AppRoutes />);
  await waitFor(() => expect(seen.last).not.toBeNull());
  act(() => seen.last?.onViewChange({ bbox: new BBox(72.5, 26, 76, 27.2) }));
  await waitFor(() => expect(seen.last?.sites.length).toBeGreaterThan(2));
  act(() => seen.last?.onPickStack(siteIds));
}

describe('Stack pin', () => {
  it('lists every site at the spot with its type, status and how many people backed it', async () => {
    await openStack(['site_jdh_1', 'site_jpr_1']);
    expect(await screen.findByRole('heading', { level: 2, name: '2 sites at this spot' })).toBeInTheDocument();
    const rows = within(screen.getByRole('list', { name: 'Sites at this spot' })).getAllByRole('button');
    expect(rows).toHaveLength(2);
    const dump = rows.find((row) => within(row).queryByText('Waste dump'));
    const construction = rows.find((row) => within(row).queryByText('Open construction'));
    expect(dump).toHaveTextContent('Verified');
    expect(construction).toHaveTextContent('2 of 10 people confirmed');
  });

  it('opens a site sheet from a row and leaves the list', async () => {
    const user = userEvent.setup();
    await openStack(['site_jdh_1', 'site_jpr_1']);
    const list = await screen.findByRole('list', { name: 'Sites at this spot' });
    await user.click(within(list).getByText('Waste dump'));
    expect(await screen.findByRole('heading', { level: 2, name: 'Waste dump' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { level: 2, name: '2 sites at this spot' })).not.toBeInTheDocument();
  });

  it('closes with Escape', async () => {
    const user = userEvent.setup();
    await openStack(['site_jdh_1', 'site_jpr_1']);
    await screen.findByRole('heading', { level: 2, name: '2 sites at this spot' });
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('heading', { level: 2, name: '2 sites at this spot' })).not.toBeInTheDocument());
  });
});
