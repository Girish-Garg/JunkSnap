import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { AppRoutes } from '../src/app/AppRoutes';
import { ServiceContainer } from '../src/app/ServiceContainer';
import { CapabilityProbe } from '../src/services/CapabilityProbe';
import { EdgeHints } from '../src/services/EdgeHints';
import { EdgeHintsPreference } from '../src/services/EdgeHintsPreference';
import { MemoryStore, renderApp, testServices } from './helpers';

/** The test services, but with a device that passes the startup probe (no model ever loads here). */
function edgeCapable(store = new MemoryStore()): ServiceContainer {
  const base = testServices(store);
  const probe = new CapabilityProbe({ ...CapabilityProbe.NONE, wasmSimd: true, worker: true, offscreenCanvas: true, imageBitmap: true });
  const edge = new EdgeHints(probe, new EdgeHintsPreference(store), () => {
    throw new Error('no worker in tests');
  });
  return new ServiceContainer({ ...base, edge });
}

describe('cloud mode is unchanged', () => {
  it('shows no hint layer over the viewfinder and loads no model', async () => {
    await renderApp(<AppRoutes />, { route: '/snap' });
    expect(await screen.findByRole('button', { name: 'Take photo' })).toBeInTheDocument();
    expect(document.querySelector('.edge-overlay')).toBeNull();
  });

  it('has no On-device hints setting on a device that failed the probe', async () => {
    await renderApp(<AppRoutes />, { route: '/account' });
    expect(await screen.findByText('Appearance')).toBeInTheDocument();
    expect(screen.queryByRole('switch', { name: 'On-device hints' })).toBeNull();
  });
});

describe('On-device hints setting', () => {
  it('is on by default when the probe passes and remembers when turned off', async () => {
    const store = new MemoryStore();
    await renderApp(<AppRoutes />, { route: '/account', services: edgeCapable(store) });
    const toggle = await screen.findByRole('switch', { name: 'On-device hints' });
    expect(toggle).toHaveAttribute('aria-checked', 'true');
    await userEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-checked', 'false');
    expect(new EdgeHintsPreference(store).on()).toBe(false);
  });

  it('is labelled in Hindi', async () => {
    await renderApp(<AppRoutes />, { route: '/account', services: edgeCapable(), language: 'hi' });
    expect(await screen.findByRole('switch', { name: 'फ़ोन पर संकेत' })).toBeInTheDocument();
  });
});
