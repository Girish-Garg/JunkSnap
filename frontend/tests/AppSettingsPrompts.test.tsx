import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MapStatus } from '../src/features/map/components/MapStatus';
import { ShutterControls } from '../src/features/snap/components/ShutterControls';
import { renderApp } from './helpers';

const DENIED = { icon: 'locate', key: 'notice.locationDenied', tone: 'info' } as const;
const NO_FIX = { fix: null, problem: 'denied' } as const;

function insideApp() {
  const bridge = { print: vi.fn(), openAppSettings: vi.fn() };
  Object.assign(window, { JunkSnapAndroid: bridge });
  return bridge;
}

describe('blocked location inside the Android app', () => {
  afterEach(() => {
    delete (window as { JunkSnapAndroid?: unknown }).JunkSnapAndroid;
  });

  it('points to the browser settings in a browser', async () => {
    await renderApp(<MapStatus notice={DENIED} />);
    expect(screen.getByText('Location is blocked in your browser.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Open app settings' })).toBeNull();
  });

  it('points to the app settings and opens them from the map notice', async () => {
    const bridge = insideApp();
    await renderApp(<MapStatus notice={DENIED} />);
    expect(screen.getByText('Location is blocked for JunkSnap.')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Open app settings' }));
    expect(bridge.openAppSettings).toHaveBeenCalledOnce();
  });

  it('shows the app steps and the settings button under the shutter', async () => {
    insideApp();
    await renderApp(<ShutterControls ready gps={NO_FIX} onShoot={vi.fn()} />);
    expect(screen.getByText(/Tap Open app settings, then Permissions, Location, Allow/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Open app settings' })).toBeInTheDocument();
  });
});
