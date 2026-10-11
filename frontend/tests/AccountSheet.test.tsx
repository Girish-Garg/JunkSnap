import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { AppRoutes } from '../src/app/AppRoutes';
import { MemoryStore, renderApp, testServices } from './helpers';

vi.mock('../src/features/map/components/SiteMapView', () => ({ SiteMapView: () => null }));

const JOIN = 'Sign in or create an account';

// Decision 20261010-0227: browsing needs no sign-in, and settings are part of browsing.
describe('Account when signed out', () => {
  it('opens from the tab with a sign-in card, settings and the welcome cards, not a sign-in wall', async () => {
    const user = userEvent.setup();
    await renderApp(<AppRoutes />);
    await user.click(screen.getByRole('button', { name: 'Account' }));
    expect(screen.getByRole('heading', { level: 2, name: 'Account' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { level: 2, name: 'Sign in' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Account' })).toHaveAttribute('aria-current', 'page');
    const card = screen.getByRole('region', { name: JOIN });
    expect(card).toHaveTextContent('Sign in to report waste, vote on reports and send letters.');
    expect(within(card).getByRole('button', { name: 'Sign in' })).toBeInTheDocument();
    expect(within(card).getByRole('button', { name: 'Create account' })).toBeInTheDocument();
    const settings = screen.getByRole('region', { name: 'Settings' });
    expect(within(settings).getByRole('group', { name: 'Language' })).toBeInTheDocument();
    await user.click(within(within(settings).getByRole('group', { name: 'Appearance' })).getByRole('button', { name: 'Dark' }));
    expect(within(settings).getByRole('button', { name: 'Dark' })).toHaveAttribute('aria-pressed', 'true');
    await user.click(screen.getByRole('button', { name: 'How JunkSnap works' }));
    expect(screen.getByRole('dialog', { name: 'How JunkSnap works' })).toBeInTheDocument();
  });

  it('opens sign-up from the card', async () => {
    const user = userEvent.setup();
    await renderApp(<AppRoutes />, { route: '/account' });
    await user.click(within(screen.getByRole('region', { name: JOIN })).getByRole('button', { name: 'Create account' }));
    expect(screen.getByRole('heading', { level: 2, name: 'Create account' })).toBeInTheDocument();
  });
});

describe('Account when signed out, in Hindi', () => {
  it('says what an account unlocks in Hindi', async () => {
    await renderApp(<AppRoutes />, { route: '/account', language: 'hi' });
    const card = screen.getByRole('region', { name: 'साइन इन करें या खाता बनाएँ' });
    expect(card).toHaveTextContent('कचरे की रिपोर्ट करने, रिपोर्टों पर वोट देने और पत्र भेजने के लिए साइन इन करें।');
  });
});

describe('Account when signed in', () => {
  it('is unchanged: who is signed in, no sign-in card, and Sign out at the foot', async () => {
    const store = new MemoryStore();
    store.setItem('junksnap.session', 'resident@example.com');
    await renderApp(<AppRoutes />, { route: '/account', services: testServices(store) });
    expect(screen.getByText('Signed in as resident@example.com')).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: JOIN })).not.toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Settings' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sign out' })).toBeInTheDocument();
  });
});
