import { screen, waitFor, within } from '@testing-library/react';
import userEvent, { type UserEvent } from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { AppRoutes } from '../src/app/AppRoutes';
import type { ServiceContainer } from '../src/app/ServiceContainer';
import { FakeReportApi } from './FakeReportApi';
import { MemoryStore, renderApp, testServices } from './helpers';
import { fixedGeolocation, type SnapTestOptions } from './snapFakes';

vi.mock('../src/features/map/components/SiteMapView', () => ({ SiteMapView: () => null }));

const PHOTO_FOR = 'This photo goes with your No bin report. Your location must be 50 m or better.';

async function signedIn(options: Partial<SnapTestOptions> = {}): Promise<ServiceContainer> {
  const services = testServices(new MemoryStore(), options);
  await services.auth.signUp('resident@example.com', 'jodhpur2026');
  await services.auth.confirmSignUp('resident@example.com', '123456');
  return services;
}

// No bin here, then "Add a photo instead", then the shutter.
async function noBinPhoto(user: UserEvent) {
  await user.click(within(screen.getByRole('group', { name: 'Capture' })).getByRole('button', { name: 'No bin here' }));
  await user.click(screen.getByRole('button', { name: 'Add a photo instead (optional)' }));
  expect(screen.getByText(PHOTO_FOR)).toBeInTheDocument();
  const shutter = await screen.findByRole('button', { name: 'Take photo' });
  await waitFor(() => expect(shutter).toBeEnabled());
  await user.click(shutter);
}

describe('No bin with a photo', () => {
  it('keeps the No bin type from "Add a photo instead" and sends it as no_bin', async () => {
    const user = userEvent.setup();
    const api = new FakeReportApi();
    api.status_ = 'verified';
    await renderApp(<AppRoutes />, { route: '/snap', services: await signedIn({ api }) });
    await noBinPhoto(user);
    expect(await screen.findByRole('radio', { name: 'No bin or pickup' })).toHaveAttribute('aria-checked', 'true');
    await user.click(screen.getByRole('radio', { name: 'No bin nearby' }));
    await user.click(screen.getByRole('button', { name: 'Send report' }));
    await screen.findByText('Verified');
    const upload = api.bodies('submit')[0];
    expect(upload).toMatchObject({ report_type: 'no_bin', context: 'no_bin' });
    // A no-bin report is about where the reporter stands: never a long-range target.
    expect(upload).not.toHaveProperty('target');
  });
});

describe('No bin with a photo: location and mode', () => {
  it('holds Send while the fix is worse than 50 m, and keeps No bin after a retake', async () => {
    const user = userEvent.setup();
    await renderApp(<AppRoutes />, { route: '/snap', services: await signedIn({ geolocation: fixedGeolocation(85) }) });
    await noBinPhoto(user);
    await user.click(await screen.findByRole('radio', { name: 'No bin nearby' }));
    expect(screen.getByRole('button', { name: 'Send report' })).toBeDisabled();
    expect(screen.getByRole('alert')).toHaveTextContent('A no-bin report needs your location to 50 m or better; this photo\'s is ±85 m.');
    await user.click(screen.getByRole('button', { name: 'Retake' }));
    expect(await screen.findByText(PHOTO_FOR)).toBeInTheDocument();
  });

  it('starts fresh when you pick Photo yourself', async () => {
    const user = userEvent.setup();
    await renderApp(<AppRoutes />, { route: '/snap', services: await signedIn() });
    const modes = screen.getByRole('group', { name: 'Capture' });
    await user.click(within(modes).getByRole('button', { name: 'No bin here' }));
    await user.click(screen.getByRole('button', { name: 'Add a photo instead (optional)' }));
    await user.click(within(modes).getByRole('button', { name: 'Photo' }));
    expect(screen.queryByText(PHOTO_FOR)).not.toBeInTheDocument();
  });
});
