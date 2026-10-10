import { act, renderHook, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { AppRoutes } from '../src/app/AppRoutes';
import { BBox } from '../src/domain/BBox';
import type { SiteMapBindings } from '../src/features/map/hooks/useSiteMap';
import { HistoryLayers } from '../src/ui/HistoryLayers';
import { useHistoryLayer } from '../src/ui/useHistoryLayer';
import { renderApp } from './helpers';

const seen: { last: SiteMapBindings | null } = { last: null };

vi.mock('../src/features/map/components/SiteMapView', () => ({
  SiteMapView: (props: SiteMapBindings) => {
    seen.last = props;
    return null;
  },
}));

const heading = (name: string) => screen.queryByRole('heading', { level: 2, name });

async function noteOpen() {
  const user = userEvent.setup();
  await renderApp(<AppRoutes />, { route: '/sites/site_jdh_1' });
  await user.click(await screen.findByRole('button', { name: 'Add a note' }));
  const field = screen.getByLabelText('Your note');
  await user.click(field);
  await user.type(field, 'Burns at night');
  await waitFor(() => expect(HistoryLayers.open()).toHaveLength(1));
  return { user, field };
}

// Bug hunt: Escape or back while typing a note closed the whole site sheet and lost the note.
describe('typing in a sheet is one more level', () => {
  it('the first Escape lets go of the field and keeps the note; the next closes the sheet', async () => {
    const { user, field } = await noteOpen();
    await user.keyboard('{Escape}');
    expect(field).not.toHaveFocus();
    expect(heading('Waste dump')).toBeInTheDocument();
    expect(screen.getByLabelText('Your note')).toHaveValue('Burns at night');
    await waitFor(() => expect(HistoryLayers.open()).toHaveLength(0));
    await user.keyboard('{Escape}');
    await waitFor(() => expect(heading('Waste dump')).not.toBeInTheDocument());
  });

  it('the first back lets go of the field and keeps the sheet', async () => {
    const { field } = await noteOpen();
    act(() => window.history.back());
    await waitFor(() => expect(field).not.toHaveFocus());
    expect(heading('Waste dump')).toBeInTheDocument();
    expect(screen.getByLabelText('Your note')).toHaveValue('Burns at night');
  });
});

describe('the pin preview card', () => {
  it('closes with its close button and with Escape', async () => {
    const user = userEvent.setup();
    await renderApp(<AppRoutes />);
    await waitFor(() => expect(seen.last).not.toBeNull());
    act(() => seen.last?.onViewChange({ bbox: new BBox(72.5, 26, 76, 27.2) }));
    await waitFor(() => expect(seen.last?.sites.length).toBeGreaterThan(2));
    act(() => seen.last?.onPick('site_jdh_1'));
    await user.click(await screen.findByRole('button', { name: 'Close preview' }));
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Details' })).not.toBeInTheDocument());
    act(() => seen.last?.onPick('site_jdh_1'));
    await screen.findByRole('button', { name: 'Details' });
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Details' })).not.toBeInTheDocument());
    await waitFor(() => expect(HistoryLayers.open()).toHaveLength(0));
  });
});

describe('focus', () => {
  it('goes back to the button that opened a sheet when it closes', async () => {
    const user = userEvent.setup();
    await renderApp(<AppRoutes />);
    const tab = screen.getByRole('button', { name: 'Areas' });
    await user.click(tab);
    await screen.findByRole('heading', { level: 2, name: 'Areas' });
    await user.click(screen.getByRole('button', { name: 'Close areas' }));
    await waitFor(() => expect(heading('Areas')).not.toBeInTheDocument());
    expect(screen.getByRole('button', { name: 'Areas' })).toHaveFocus();
  });
});

describe('two requests to go back at once', () => {
  it('the second waits for the first and never pops the level under it', async () => {
    renderHook(() => [useHistoryLayer('a', true, () => undefined), useHistoryLayer('b', true, () => undefined)]);
    expect(HistoryLayers.open()).toHaveLength(2);
    const first = vi.fn();
    const second = vi.fn();
    act(() => {
      HistoryLayers.unwind(first);
      HistoryLayers.unwind(second);
    });
    await waitFor(() => expect(second).toHaveBeenCalledTimes(1));
    expect(first).toHaveBeenCalledTimes(1);
    expect(HistoryLayers.open()).toHaveLength(0);
  });
});
