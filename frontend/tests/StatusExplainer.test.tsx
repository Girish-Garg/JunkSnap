import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ServiceContainer } from '../src/app/ServiceContainer';
import { SiteStatusChip } from '../src/domain/SiteStatusChip';
import { SitePanel } from '../src/features/site/components/SitePanel';
import { SitePreviewCard } from '../src/features/site/components/SitePreviewCard';
import en from '../src/i18n/en.json';
import hi from '../src/i18n/hi.json';
import { Sharer, type ShareApi } from '../src/services/Sharer';
import { renderApp, testServices } from './helpers';
import { testSite, type SitePatch } from './siteBuilder';

vi.mock('../src/features/map/components/SiteMapView', () => ({ SiteMapView: () => null }));

const WAITING: SitePatch = { verification: 'unverified', backers: { count: 3, needed: 10, photo_people: 1, vote_people: 2 } };
const ASK = 'Ask neighbours to confirm';
const URL_OF_SITE = `${window.location.origin}/sites/site_test_1`;
const ASK_TEXT = 'Can you confirm this waste spot near Ward 37? It needs 10 people and has 3 so far.';

afterEach(() => {
  vi.restoreAllMocks();
  window.history.replaceState(null, '');
});

async function openExplainer(button: string, title = button) {
  await userEvent.click(screen.getByRole('button', { name: button }));
  return screen.getByRole('dialog', { name: title });
}

describe('the status explainer', () => {
  it('has plain words in en and hi for every status chip', () => {
    for (const key of Object.keys(en.chip)) {
      const name = SiteStatusChip.explainKey({ key: `chip.${key}`, tone: 'waiting' }).replace('explain.', '');
      expect(en.explain).toHaveProperty(name);
      expect(hi.explain).toHaveProperty(name);
    }
  });
});

// A browser ignores focus() inside an inert subtree (jsdom does not), so records whether the page was still inert.
function inertWhenFocused(element: HTMLElement, page: HTMLElement): boolean[] {
  const seen: boolean[] = [];
  const focus = HTMLElement.prototype.focus;
  vi.spyOn(HTMLElement.prototype, 'focus').mockImplementation(function (this: HTMLElement, options?: FocusOptions) {
    if (this === element) seen.push(page.inert);
    focus.call(this, options);
  });
  return seen;
}

describe('the status explainer on the pin card', () => {
  it('opens from the chip without opening the site; back closes only it and focuses the chip on a usable page', async () => {
    const onDetails = vi.fn();
    const onClose = vi.fn();
    const view = await renderApp(<SitePreviewCard site={testSite(WAITING)} userLocation={null} onDetails={onDetails} onClose={onClose} />, { history: 'browser' });
    const dialog = await openExplainer('Waiting · 3 of 10');
    const chip = screen.getByRole('button', { name: 'Waiting · 3 of 10' });
    const inert = inertWhenFocused(chip, view.container);
    expect(dialog).toHaveTextContent("10 different people must back this spot with a photo or a yes vote before it counts as verified. You can help by confirming if you're within 1 km.");
    expect(within(dialog).getByRole('button', { name: ASK })).toBeInTheDocument();
    await userEvent.click(within(dialog).getByText(/10 different people/));
    expect(onDetails).not.toHaveBeenCalled();
    act(() => window.history.back());
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(onClose).not.toHaveBeenCalled();
    expect(chip).toHaveFocus();
    expect(inert).toEqual([false]);
  });
});

describe('the status explainer on the site sheet', () => {
  it.each([
    ['a verified site', {}, 'Verified', '10 different people backed this spot'],
    ['a site people say is cleared', { clearance: { count: 1, needed: 3, still_there: 0 } }, '1 of 3 say cleared', 'It leaves the map once 3 different people say so'],
    ['an expired site', { status: 'expired', verification: 'unverified' }, 'Expired', 'Nobody added a photo or a vote here for 90 days'],
    ['a withdrawn site', { status: 'removed', verification: 'unverified' }, 'Withdrawn', 'Its reporter withdrew the report before it was verified'],
    ['a no-bin zone people say has a bin', { report_type: 'no_bin', clearance: { count: 1, needed: 3, still_there: 0 } }, '1 of 3 say cleared', 'Someone says a bin is here now'],
    ['a cleared no-bin zone', { report_type: 'no_bin', status: 'cleaned' }, 'Cleared', 'Enough people said a bin is here now, so this no-bin zone left the map'],
  ] as const)('explains %s from the site sheet chip, with no Ask neighbours', async (_, patch: SitePatch, chip, words) => {
    await renderApp(<SitePanel site={testSite(patch)} userLocation={null} />, { history: 'browser' });
    const dialog = await openExplainer(chip);
    expect(dialog).toHaveTextContent(words);
    expect(within(dialog).queryByRole('button', { name: ASK })).not.toBeInTheDocument();
    await userEvent.click(within(dialog).getByRole('button', { name: 'Close' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });
});

describe('the "n of 10" count explainer', () => {
  it('explains the "n of 10" count on the site sheet, and Escape closes it', async () => {
    await renderApp(<SitePanel site={testSite({ ...WAITING, clearance: { count: 1, needed: 3, still_there: 0 } })} userLocation={null} />, { history: 'browser' });
    const dialog = await openExplainer('3 of 10 people confirmed', 'Waiting · 3 of 10');
    expect(dialog).toHaveTextContent('10 different people must back this spot');
    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('promises no letter for a verified site that has left the map', async () => {
    await renderApp(<SitePanel site={testSite({ status: 'expired' })} userLocation={null} />, { history: 'browser' });
    const dialog = await openExplainer('Verified by 10 people', 'Verified');
    expect(dialog).toHaveTextContent('10 different people backed this spot with a photo or a yes vote before it left the map.');
    expect(dialog).not.toHaveTextContent(/letter/);
  });
});

function sharing(api: Partial<ShareApi>) {
  const writeText = vi.fn(async () => undefined);
  const sharer = new Sharer({ clipboard: { writeText } as unknown as Clipboard, ...api });
  return { services: new ServiceContainer({ ...testServices(), sharer }), writeText };
}

describe('Ask neighbours to confirm', () => {
  it.each([
    ['shows on a waiting site', WAITING, 1],
    ['keeps only the normal Share on a verified site', {}, 0],
    ['hides on an expired site', { ...WAITING, status: 'expired' }, 0],
    ['hides on a withdrawn site', { ...WAITING, status: 'removed' }, 0],
  ] as const)('%s', async (_, patch: SitePatch, shown) => {
    await renderApp(<SitePanel site={testSite(patch)} userLocation={null} />);
    expect(screen.queryAllByRole('button', { name: ASK })).toHaveLength(shown);
    if (!patch.status) expect(screen.getByRole('button', { name: 'Share' })).toBeInTheDocument();
  });

  it('shares the site link with where it is and how many people it still needs', async () => {
    const share = vi.fn(async () => undefined);
    await renderApp(<SitePanel site={testSite(WAITING)} userLocation={null} />, { services: sharing({ share }).services });
    await userEvent.click(screen.getByRole('button', { name: ASK }));
    expect(share).toHaveBeenCalledWith({ title: 'Waste dump', text: ASK_TEXT, url: URL_OF_SITE });
  });

  it('copies the message with the link where there is no share sheet', async () => {
    const { services, writeText } = sharing({});
    await renderApp(<SitePanel site={testSite(WAITING)} userLocation={null} />, { services });
    await userEvent.click(screen.getByRole('button', { name: ASK }));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith(`${ASK_TEXT} ${URL_OF_SITE}`));
    expect(await screen.findByRole('button', { name: 'Copied' })).toBeInTheDocument();
  });
});
