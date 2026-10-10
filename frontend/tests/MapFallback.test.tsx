import { act, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AppRoutes } from '../src/app/AppRoutes';
import { MockApiClient } from '../src/services/MockApiClient';
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
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue((available ? { getExtension: () => null } : null) as never);

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
    const logged = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    withWebGl2(true);
    await renderApp(<AppRoutes />);
    expect(await screen.findByText(/This browser can't draw the map/)).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: /Contaminated water/ })).toBeInTheDocument();
    // Logged once with the app's structured error tag (issue 124).
    expect(logged).toHaveBeenCalledWith('[junksnap:error]', expect.objectContaining({ where: 'map' }));
  });
});

describe('map list mode', () => {
  it('hides search and locate, which only move the map', async () => {
    withWebGl2(false);
    await renderApp(<AppRoutes />);
    await screen.findByRole('button', { name: /Waste dump/ });
    expect(screen.queryByRole('search')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Show my location' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Filters/ })).toBeInTheDocument();
  });

  it('says there are no reports only after loading finishes', async () => {
    let finish: (sites: never[]) => void = () => undefined;
    vi.spyOn(MockApiClient.prototype, 'listSites').mockReturnValue(new Promise((resolve) => (finish = resolve)));
    withWebGl2(false);
    await renderApp(<AppRoutes />);
    expect(screen.queryByText('No reports here yet.')).not.toBeInTheDocument();
    await act(async () => finish([]));
    expect(await screen.findByText('No reports here yet.')).toBeInTheDocument();
  });

});

describe('map list mode language', () => {
  it('keeps the language toggle beside Filters, since the search field is hidden', async () => {
    const user = userEvent.setup();
    withWebGl2(false);
    await renderApp(<AppRoutes />);
    await user.click(screen.getByRole('button', { name: 'हिन्दी' }));
    expect(await screen.findByText(/यह ब्राउज़र नक्शा नहीं दिखा पा रहा/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'English' })).toBeInTheDocument();
  });

  it('inside the Android app, gives advice for the app instead of the browser settings', async () => {
    withWebGl2(false);
    vi.stubGlobal('__TAURI__', { core: { invoke: async () => undefined } });
    await renderApp(<AppRoutes />);
    expect(screen.getByText(/update Android System WebView/)).toBeInTheDocument();
    expect(screen.queryByText(/hardware acceleration in your browser/)).not.toBeInTheDocument();
    expect(screen.queryByText(/This browser/)).not.toBeInTheDocument();
    vi.unstubAllGlobals();
  });

  it('shows the notice in Hindi', async () => {
    withWebGl2(false);
    await renderApp(<AppRoutes />, { language: 'hi' });
    expect(screen.getByText(/यह ब्राउज़र नक्शा नहीं दिखा पा रहा/)).toBeInTheDocument();
  });
});
