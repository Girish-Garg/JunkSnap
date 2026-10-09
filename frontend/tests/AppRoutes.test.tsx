import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { AppRoutes } from '../src/app/AppRoutes';
import { renderApp } from './helpers';

// jsdom has no WebGL, so the MapLibre canvas is replaced; routes, sheets and chips are real.
vi.mock('../src/features/map/components/SiteMapView', () => ({ SiteMapView: () => null }));

describe('routes', () => {
  it('opens the site panel for /sites/:id', async () => {
    await renderApp(<AppRoutes />, { route: '/sites/site_jdh_1' });
    expect(await screen.findByRole('heading', { level: 2, name: 'Waste dump' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Close site details' })).toBeInTheDocument();
  });

  it('closes the panel and returns to the map', async () => {
    const user = userEvent.setup();
    await renderApp(<AppRoutes />, { route: '/sites/site_jdh_1' });
    await user.click(await screen.findByRole('button', { name: 'Close site details' }));
    expect(screen.queryByRole('heading', { level: 2 })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Snap' })).toBeInTheDocument();
  });

  it('says so when the site does not exist', async () => {
    await renderApp(<AppRoutes />, { route: '/sites/site_missing' });
    expect(await screen.findByText('Could not load this site.')).toBeInTheDocument();
  });

  it('opens the Snap sheet from the primary button', async () => {
    const user = userEvent.setup();
    await renderApp(<AppRoutes />);
    await user.click(screen.getByRole('button', { name: 'Snap' }));
    expect(screen.getByRole('heading', { level: 2, name: 'Snap a waste site' })).toBeInTheDocument();
  });
});
