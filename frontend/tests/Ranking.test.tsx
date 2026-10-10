import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { AppRoutes } from '../src/app/AppRoutes';
import { renderApp } from './helpers';

vi.mock('../src/features/map/components/SiteMapView', () => ({ SiteMapView: () => null }));

describe('City ranking', () => {
  it('opens on Jodhpur assembly seats, worst first, with counts beside scores', async () => {
    await renderApp(<AppRoutes />, { route: '/ranking' });
    expect(await screen.findByRole('heading', { name: 'Jodhpur ranking' })).toBeInTheDocument();
    const list = await screen.findByRole('list', { name: 'Areas, worst first' });
    const [first, ...rest] = within(list).getAllByRole('link');
    expect(first).toHaveAttribute('href', '/areas/assembly/s20-ac-128');
    expect(first).toHaveTextContent('Mean of 3 shown scores · 14 verified reports');
    expect(within(first!).getByText('44')).toBeInTheDocument();
    expect(within(first!).getByText('Pilot city')).toBeInTheDocument();
    expect(rest.length).toBeGreaterThan(0);
    for (const row of rest) {
      expect(row).toHaveTextContent(/Not enough verified reports \(\d+ of 10\)/);
      // The note already gives the count; it is never repeated as "n verified reports".
      expect(row).not.toHaveTextContent(/\d verified reports/);
      expect(row).toHaveTextContent('No score yet');
    }
  });
});

describe('City ranking controls', () => {
  it('switches city and area type', async () => {
    const user = userEvent.setup();
    await renderApp(<AppRoutes />, { route: '/ranking?kind=loksabha' });
    expect(await screen.findByRole('link', { name: /Jodhpur/ })).toHaveAttribute('href', '/areas/loksabha/s20-pc-16');
    await user.click(screen.getByRole('button', { name: 'Jaipur' }));
    expect(await screen.findByRole('heading', { name: 'Jaipur ranking' })).toBeInTheDocument();
    expect(await screen.findByRole('link', { name: /Jaipur/ })).toHaveAttribute('href', expect.stringMatching(/^\/areas\/loksabha\//));
    await user.click(screen.getByRole('button', { name: 'Wards' }));
    expect(await screen.findByText('No areas of this type have reports in this city yet.')).toBeInTheDocument();
  });

  it('is reached from the Areas tab', async () => {
    await renderApp(<AppRoutes />, { route: '/areas' });
    expect(await screen.findByRole('link', { name: 'City ranking' })).toHaveAttribute('href', '/ranking');
  });
});
