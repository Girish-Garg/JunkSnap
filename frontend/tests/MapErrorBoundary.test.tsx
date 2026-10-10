import { screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AppRoutes } from '../src/app/AppRoutes';
import { renderApp } from './helpers';

// A map view that crashes while rendering, past the WebGL2 check and the constructor guard.
vi.mock('../src/features/map/components/SiteMapView', () => ({
  SiteMapView: () => {
    throw new Error('Map view crashed');
  },
}));

afterEach(() => vi.restoreAllMocks());

describe('map error boundary', () => {
  it('catches a crash in the map view and shows the list', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({} as never);
    await renderApp(<AppRoutes />);
    expect(await screen.findByText(/This browser can't draw the map/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Areas' })).toBeInTheDocument();
  });
});
