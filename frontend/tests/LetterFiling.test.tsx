import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AppRoutes } from '../src/app/AppRoutes';
import type { ServiceContainer } from '../src/app/ServiceContainer';
import { ToastHost } from '../src/features/actions/components/ToastHost';
import { LetterMailto, NO_KNOWN_ADDRESSES } from '../src/features/letters/LetterMailto';
import { DEFAULTS } from './config';
import { MemoryStore, renderApp, testServices } from './helpers';

vi.mock('../src/features/map/components/SiteMapView', () => ({ SiteMapView: () => null }));

const SHORT = 'The full letter is pasted below (or attached).';
const bodyOf = (url: string) => new URL(url).searchParams.get('body');

async function draftedLetter(prepare: (services: ServiceContainer) => void = () => undefined): Promise<ServiceContainer> {
  const services = testServices(new MemoryStore());
  prepare(services);
  await services.auth.signUp('resident@example.com', 'jodhpur2026');
  await services.auth.confirmSignUp('resident@example.com', '123456');
  await renderApp(<><AppRoutes /><ToastHost /></>, { route: '/sites/site_jdh_1/letter', services });
  await userEvent.click(screen.getByRole('button', { name: 'Draft letter' }));
  await screen.findByRole('article');
  return services;
}

// jsdom cannot open a mail app; the link's own click handler still runs.
const stopNavigation = (event: Event) => event.preventDefault();
beforeEach(() => document.addEventListener('click', stopNavigation, true));
afterEach(() => document.removeEventListener('click', stopNavigation, true));

describe('send by email', () => {
  it('puts only the known office addresses in To and Cc, and encodes the letter', () => {
    const recipients = { to: ['commissioner@jmc.example.in', 'not an address', 'x@y.in?bcc=other@z.in'], cc: ['mla.office@example.in', ''] };
    const mail = new LetterMailto(recipients).compose('Waste dump & drain', 'To: Commissioner\nRule 15(1): "quote"', SHORT);
    expect(mail).toEqual({
      long: false,
      url: 'mailto:commissioner@jmc.example.in?cc=mla.office@example.in&subject=Waste%20dump%20%26%20drain&body=To%3A%20Commissioner%0D%0ARule%2015(1)%3A%20%22quote%22',
    });
    expect(new LetterMailto(NO_KNOWN_ADDRESSES).compose('S', 'B', SHORT).url).toBe('mailto:?subject=S&body=B');
  });

  it('sends a short body for a letter too long for the link', () => {
    const mail = new LetterMailto(NO_KNOWN_ADDRESSES).compose('Subject', 'A long letter. '.repeat(200), SHORT);
    expect(mail.long).toBe(true);
    expect(mail.url.length).toBeLessThanOrEqual(DEFAULTS.limits.mailtoMaxLength);
    expect(bodyOf(mail.url)).toBe(SHORT);
  });

  it('copies a long letter first, says so, and leaves the addresses for the resident', async () => {
    const services = await draftedLetter();
    const copy = vi.spyOn(services.sharer, 'copy');
    const link = screen.getByRole('link', { name: 'Send by email' });
    expect(link.getAttribute('href')).toMatch(/^mailto:\?subject=Request%20to%20clear%20a%20waste%20dump/);
    expect(bodyOf(link.getAttribute('href') ?? '')).toMatch(/^The full letter is pasted below \(or attached\)\.\r\n\r\nPhotos and counts online: /);
    await userEvent.click(link);
    expect(copy).toHaveBeenCalledWith(expect.stringContaining('SHA-256 of the official text: bbf4755536af'));
    await waitFor(() => expect(document.querySelector('.app-toast')).toHaveTextContent('The letter is too long for an email link, so it was copied.'));
  });
});

describe('share', () => {
  it("shares the letter's text through the browser's share sheet", async () => {
    const share = vi.fn().mockResolvedValue('shared');
    await draftedLetter((services) => {
      vi.spyOn(services.sharer, 'canShare').mockReturnValue(true);
      vi.spyOn(services.sharer, 'shareText').mockImplementation(share);
    });
    await userEvent.click(screen.getByRole('button', { name: 'Share' }));
    expect(share).toHaveBeenCalledWith(expect.stringMatching(/^Request to clear a waste dump/), expect.stringContaining('Rules quoted'));
  });
});
