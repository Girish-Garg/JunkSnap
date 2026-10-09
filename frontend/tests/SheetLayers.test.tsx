import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { AppConfig } from '../src/app/AppConfig';
import { AppRoutes } from '../src/app/AppRoutes';
import { ServiceContainer } from '../src/app/ServiceContainer';
import { MemoryStore, renderApp } from './helpers';

vi.mock('../src/features/map/components/SiteMapView', () => ({ SiteMapView: () => null }));

describe('Escape with stacked sheets', () => {
  it('closes only the topmost sheet each time', async () => {
    const user = userEvent.setup();
    await renderApp(<AppRoutes />, { route: '/sites/site_jdh_1' });
    await user.click(await screen.findByRole('button', { name: 'Letter' }));
    expect(screen.getByRole('heading', { level: 2, name: 'Sign in' })).toBeInTheDocument();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('heading', { level: 2, name: 'Sign in' })).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'Waste dump' })).toBeInTheDocument();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('heading', { level: 2, name: 'Waste dump' })).not.toBeInTheDocument();
  });
});

describe('sign-in in live mode', () => {
  it('says sign-in is not available yet until the Cognito adapter lands', async () => {
    const user = userEvent.setup();
    const config = AppConfig.fromEnv({ VITE_API_URL: 'https://api.example.test' });
    const share = { clipboard: { writeText: async () => undefined } as unknown as Clipboard };
    const services = ServiceContainer.build(config, { store: new MemoryStore(), geolocation: undefined, share });
    await renderApp(<AppRoutes />, { services });
    await user.click(screen.getByRole('button', { name: 'Report' }));
    expect(screen.getByText('Sign-in is not available yet. You can still browse the map.')).toBeInTheDocument();
    await user.type(screen.getByLabelText('Email'), 'resident@example.com');
    await user.type(screen.getByLabelText('Password'), 'Jodhpur-2026');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Sign-in is not available yet.');
  });
});
