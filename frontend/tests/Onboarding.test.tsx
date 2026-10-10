import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { AppRoutes } from '../src/app/AppRoutes';
import { OnboardingPreference } from '../src/services/OnboardingPreference';
import { MemoryStore, renderApp, testServices } from './helpers';

vi.mock('../src/features/map/components/SiteMapView', () => ({ SiteMapView: () => null }));

describe('How JunkSnap works', () => {
  it('steps through the cards, names offices and never people, and remembers it was seen', async () => {
    const user = userEvent.setup();
    const store = new MemoryStore();
    await renderApp(<AppRoutes />, { route: '/welcome', services: testServices(store) });
    expect(screen.getByRole('dialog', { name: 'How JunkSnap works' })).toBeInTheDocument();
    expect(new OnboardingPreference(store).seen()).toBe(false);
    expect(screen.getByRole('heading', { name: 'Waste piles up for three reasons' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Next' }));
    await user.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByText('Local body (Municipal Corporation)')).toBeInTheDocument();
    expect(screen.getByText('Ward councillor')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Next' }));
    // The last card keeps only the close button (also named Skip); the footer offers Explore alone.
    expect(screen.getAllByRole('button', { name: 'Skip' })).toHaveLength(1);
    expect(new OnboardingPreference(store).seen()).toBe(false);
    await user.click(screen.getByRole('button', { name: 'Explore' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(new OnboardingPreference(store).seen()).toBe(true);
  });
});

describe('How JunkSnap works: seen', () => {
  it('counts as seen when skipped, not when merely opened', async () => {
    const user = userEvent.setup();
    const store = new MemoryStore();
    await renderApp(<AppRoutes />, { route: '/welcome', services: testServices(store) });
    expect(new OnboardingPreference(store).seen()).toBe(false);
    const skips = screen.getAllByRole('button', { name: 'Skip' });
    expect(skips).toHaveLength(2);
    await user.click(skips[1]!);
    expect(new OnboardingPreference(store).seen()).toBe(true);
  });

  it('opens again from Account', async () => {
    const user = userEvent.setup();
    const store = new MemoryStore();
    store.setItem('junksnap.session', 'resident@example.com');
    await renderApp(<AppRoutes />, { route: '/account', services: testServices(store) });
    await user.click(screen.getByRole('button', { name: 'How JunkSnap works' }));
    expect(screen.getByRole('dialog', { name: 'How JunkSnap works' })).toBeInTheDocument();
  });
});
