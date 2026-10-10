import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { AppRoutes } from '../src/app/AppRoutes';
import { SheetHistory } from '../src/app/SheetHistory';
import { renderApp } from './helpers';

// A map stand-in that reports the opening Jodhpur view, so the map loads its sites.
vi.mock('../src/features/map/components/SiteMapView', async () => {
  const { useEffect } = await import('react');
  const { BBox } = await import('../src/domain/BBox');
  const view = { bbox: BBox.around([73.02, 26.27], 0.99) };
  return {
    SiteMapView: ({ onViewChange }: { onViewChange: (next: typeof view) => void }) => {
      useEffect(() => onViewChange(view), [onViewChange]);
      return null;
    },
  };
});

const heading = (name: string) => screen.queryByRole('heading', { level: 2, name });

describe('SheetHistory', () => {
  it('reads the depth from router state and ignores anything else', () => {
    expect(SheetHistory.depth(null)).toBe(0);
    expect(SheetHistory.depth({ depth: 'x' })).toBe(0);
    expect(SheetHistory.depth(SheetHistory.above(1))).toBe(2);
    expect(SheetHistory.depth(SheetHistory.at(1))).toBe(1);
  });
});

// Android's back button and the browser's both go through history: the topmost sheet closes first.
describe('back button with sheets that are not routes', () => {
  it('closes the sign-in sheet and keeps the site sheet under it', async () => {
    const user = userEvent.setup();
    await renderApp(<AppRoutes />, { route: '/sites/site_jdh_1' });
    await user.click(await screen.findByRole('button', { name: 'Letter' }));
    expect(heading('Sign in')).toBeInTheDocument();
    window.history.back();
    await waitFor(() => expect(heading('Sign in')).not.toBeInTheDocument());
    expect(heading('Waste dump')).toBeInTheDocument();
  });

  it('closes the filters sheet', async () => {
    const user = userEvent.setup();
    await renderApp(<AppRoutes />);
    await user.click(screen.getByRole('button', { name: /Filters/ }));
    expect(heading('Filters')).toBeInTheDocument();
    window.history.back();
    await waitFor(() => expect(heading('Filters')).not.toBeInTheDocument());
  });
});

describe('closing a sheet with its own button', () => {
  it('takes the history entry away again when the sheet closes with its own button', async () => {
    const user = userEvent.setup();
    await renderApp(<AppRoutes />);
    const layers = () => (window.history.state as { layers?: string[] } | null)?.layers ?? [];
    await user.click(screen.getByRole('button', { name: /Filters/ }));
    expect(layers()).toHaveLength(1);
    await user.click(screen.getByRole('button', { name: 'Close filters' }));
    await waitFor(() => expect(heading('Filters')).not.toBeInTheDocument());
    expect(layers()).toHaveLength(0);
  });
});

describe('closing route sheets', () => {
  it('returns to the sheet underneath instead of jumping to the map', async () => {
    const user = userEvent.setup();
    await renderApp(<AppRoutes />);
    await user.click(screen.getByRole('button', { name: 'Areas' }));
    await user.click(await screen.findByRole('link', { name: /Sardarpura/ }));
    expect(await screen.findByRole('heading', { level: 2, name: 'Sardarpura' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Close area' }));
    expect(await screen.findByRole('heading', { level: 2, name: 'Areas' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Close areas' }));
    await waitFor(() => expect(heading('Areas')).not.toBeInTheDocument());
    expect(screen.getByRole('button', { name: 'Map' })).toHaveAttribute('aria-current', 'page');
  });
});
