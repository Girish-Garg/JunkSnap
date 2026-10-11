import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { AppConfig, type AppEnv } from '../src/app/AppConfig';
import { ServiceContainer } from '../src/app/ServiceContainer';
import { DesktopActions } from '../src/features/map/components/DesktopActions';
import type { Language } from '../src/i18n/LanguagePreference';
import { renderApp, testServices } from './helpers';

const RELEASES = 'https://github.com/Girish-Garg/JunkSnap/releases/latest';

afterEach(() => {
  window.history.replaceState(null, '');
});

/** Desktop: tap Report (or Scan) and get the "use your phone" dialog, built with these VITE_ variables. */
async function openDialog(button: string, title: string, env: AppEnv = {}, language: Language = 'en') {
  // AppConfig.test checks the warning a value that is not an https URL gives; here it would only be noise.
  const services = new ServiceContainer({ ...testServices(), config: AppConfig.fromEnv(env, () => undefined) });
  await renderApp(<DesktopActions />, { services, language });
  await userEvent.click(screen.getByRole('button', { name: button }));
  return screen.getByRole('dialog', { name: title });
}

describe('the "Report from your phone" dialog', () => {
  it('links the Android app in a new tab, under the QR code and the address', async () => {
    const dialog = await openDialog('Report', 'Report from your phone');
    const link = within(dialog).getByRole('link', { name: 'Get the Android app' });
    expect(link).toHaveAttribute('href', RELEASES);
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    expect(within(dialog).getByText(window.location.host).compareDocumentPosition(link)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    expect(within(dialog).getByText('Works in any phone browser, or install the Android app.')).toBeInTheDocument();
  });

  it('offers the app on the Scan dialog too, at the URL the build sets', async () => {
    const url = 'https://downloads.example.test/junksnap.apk';
    const dialog = await openDialog('Scan a street', 'Scan from your phone', { VITE_ANDROID_APP_URL: url });
    expect(within(dialog).getByRole('link', { name: 'Get the Android app' })).toHaveAttribute('href', url);
  });
});

describe('the "Report from your phone" dialog without the app, and in Hindi', () => {
  it.each(['', '   ', 'http://downloads.example.test/junksnap.apk', 'javascript:alert(1)'])(
    'hides the link, and says no app store is needed, when VITE_ANDROID_APP_URL is "%s"',
    async (value) => {
      const dialog = await openDialog('Report', 'Report from your phone', { VITE_ANDROID_APP_URL: value });
      expect(within(dialog).queryByRole('link')).not.toBeInTheDocument();
      expect(within(dialog).getByText('Works in any phone browser. No app store needed.')).toBeInTheDocument();
    },
  );

  it('speaks Hindi', async () => {
    const dialog = await openDialog('रिपोर्ट', 'अपने फ़ोन से रिपोर्ट करें', {}, 'hi');
    expect(within(dialog).getByRole('link', { name: 'Android ऐप पाएँ' })).toHaveAttribute('href', RELEASES);
    expect(within(dialog).getByText('किसी भी फ़ोन ब्राउज़र में चलता है, या Android ऐप इंस्टॉल करें।')).toBeInTheDocument();
  });
});
