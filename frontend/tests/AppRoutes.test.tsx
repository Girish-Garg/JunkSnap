import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { AppRoutes } from '../src/app/AppRoutes';
import { renderApp } from './helpers';

// jsdom has no WebGL, so the MapLibre canvas is replaced; routes, sheets and controls are real.
vi.mock('../src/features/map/components/SiteMapView', () => ({ SiteMapView: () => null }));

describe('site routes', () => {
  it('opens the site panel for /sites/:id and focuses its title', async () => {
    await renderApp(<AppRoutes />, { route: '/sites/site_jdh_1' });
    const title = await screen.findByRole('heading', { level: 2, name: 'Waste dump' });
    await waitFor(() => expect(title).toHaveFocus());
  });

  it('closes the panel and returns to the map', async () => {
    const user = userEvent.setup();
    await renderApp(<AppRoutes />, { route: '/sites/site_jdh_1' });
    await user.click(await screen.findByRole('button', { name: 'Close site details' }));
    expect(screen.queryByRole('heading', { level: 2 })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Report' })).toBeInTheDocument();
  });

  it('says so when the site does not exist', async () => {
    await renderApp(<AppRoutes />, { route: '/sites/site_missing' });
    expect(await screen.findByText('Could not load this site.')).toBeInTheDocument();
  });
});

describe('filters sheet', () => {
  it('opens from the Filters pill with map modes and type counts', async () => {
    const user = userEvent.setup();
    await renderApp(<AppRoutes />);
    await user.click(screen.getByRole('button', { name: 'Filters' }));
    expect(screen.getByRole('heading', { level: 2, name: 'Filters' })).toHaveFocus();
    expect(screen.getByRole('button', { name: 'Auto' })).toHaveAttribute('aria-pressed', 'true');
    await user.click(screen.getByRole('switch', { name: /Waste dump/ }));
    expect(screen.getByRole('switch', { name: /Waste dump/ })).toHaveAttribute('aria-checked', 'false');
    expect(screen.getByRole('button', { name: 'Filters · 1' })).toBeInTheDocument();
  });
});
