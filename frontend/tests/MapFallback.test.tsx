import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AppRoutes } from '../src/app/AppRoutes';
import { renderApp } from './helpers';

// The real MapLibre map cannot run in jsdom; this stand-in throws like a browser without WebGL2.
vi.mock('../src/features/map/SiteMap', () => ({
  SiteMap: class {
    constructor() {
      throw new Error('GPUInitializationError: WebGL2 is required to display this map');
    }
  },
}));

const withWebGl2 = (available: boolean) =>
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue((available ? {} : null) as never);

afterEach(() => vi.restoreAllMocks());

describe('map fallback', () => {
  it('lists nearby sites with a notice when the browser has no WebGL2', async () => {
    const user = userEvent.setup();
    withWebGl2(false);
    await renderApp(<AppRoutes />);
    expect(screen.getByText(/This browser can't draw the map/)).toBeInTheDocument();
    await user.click(await screen.findByRole('button', { name: /Waste dump/ }));
    expect(await screen.findByRole('heading', { level: 2, name: 'Waste dump' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Report' })).toBeInTheDocument();
  });

  it('falls back to the list when the map constructor throws', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    withWebGl2(true);
    await renderApp(<AppRoutes />);
    expect(await screen.findByText(/This browser can't draw the map/)).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: /Contaminated water/ })).toBeInTheDocument();
  });

  it('shows the notice in Hindi', async () => {
    withWebGl2(false);
    await renderApp(<AppRoutes />, { language: 'hi' });
    expect(screen.getByText(/यह ब्राउज़र नक्शा नहीं दिखा पा रहा/)).toBeInTheDocument();
  });
});
