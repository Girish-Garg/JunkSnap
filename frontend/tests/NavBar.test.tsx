import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { AppRoutes } from '../src/app/AppRoutes';
import { NavItems } from '../src/features/nav/NavItems';
import { renderApp } from './helpers';

vi.mock('../src/features/map/components/SiteMapView', () => ({ SiteMapView: () => null }));

describe('NavItems.selected', () => {
  it('keeps site sheets under Map and marks the other sections', () => {
    expect(NavItems.selected('/')).toBe('map');
    expect(NavItems.selected('/sites/site_jdh_1')).toBe('map');
    expect(NavItems.selected('/snap')).toBe('report');
    expect(NavItems.selected('/areas')).toBe('areas');
    expect(NavItems.selected('/account')).toBe('account');
  });
});

describe('navigation bar', () => {
  it('opens Areas without an account and marks it as the current page', async () => {
    const user = userEvent.setup();
    await renderApp(<AppRoutes />);
    expect(screen.getByRole('button', { name: 'Map' })).toHaveAttribute('aria-current', 'page');
    await user.click(screen.getByRole('button', { name: 'Areas' }));
    expect(screen.getByRole('heading', { level: 2, name: 'Areas' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Areas' })).toHaveAttribute('aria-current', 'page');
  });

  it('asks a signed-out user to sign in before Account', async () => {
    const user = userEvent.setup();
    await renderApp(<AppRoutes />);
    await user.click(screen.getByRole('button', { name: 'Account' }));
    expect(screen.getByRole('heading', { level: 2, name: 'Sign in' })).toBeInTheDocument();
  });
});
