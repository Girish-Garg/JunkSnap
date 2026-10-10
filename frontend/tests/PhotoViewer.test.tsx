import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { QueuedReport } from '../src/domain/QueuedReport';
import { ActivityReportList } from '../src/features/activity/components/ActivityReportList';
import type { LetterText } from '../src/features/letters/LetterText';
import { EvidencePhotos } from '../src/features/letters/components/EvidencePhotos';
import { SitePanel } from '../src/features/site/components/SitePanel';
import { renderApp } from './helpers';
import { testSite } from './siteBuilder';
import { sampleDraft } from './snapFakes';

const PHOTOS = [1, 2, 3, 4].map((n) => `https://example.test/media/reports/rpt_test_${n}.jpg`);

function stage() {
  return screen.getByTestId('photo-stage');
}

function swipe(dx: number, dy = 0) {
  fireEvent.pointerDown(stage(), { pointerId: 1, clientX: 200, clientY: 300 });
  fireEvent.pointerMove(stage(), { pointerId: 1, clientX: 200 + dx, clientY: 300 + dy });
  fireEvent.pointerUp(stage(), { pointerId: 1, clientX: 200 + dx, clientY: 300 + dy });
}

async function openSitePhoto(n: number) {
  await renderApp(<SitePanel site={testSite({ photo_urls: PHOTOS })} userLocation={null} />);
  const opener = screen.getByRole('button', { name: `Blurred photo ${n} of 4` });
  opener.focus();
  fireEvent.click(opener);
  return screen.getByRole('dialog', { name: `Photo ${n} of 4` });
}

function viewerOwnsTop() {
  return (window.history.state as Record<string, unknown> | null)?.['junksnapPhotoViewer'] === true;
}

afterEach(() => {
  // Leave history as each test found it: a viewer still open owns the top entry.
  window.history.replaceState(null, '');
});

describe('Site photo strip', () => {
  it('shows every blurred photo with a count badge and opens the tapped one', async () => {
    await renderApp(<SitePanel site={testSite({ photo_urls: PHOTOS })} userLocation={null} />);
    const strip = screen.getByRole('list', { name: 'Photos' });
    expect(within(strip).getAllByRole('img')).toHaveLength(4);
    expect(screen.getByText('1 / 4')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Blurred photo 3 of 4' }));
    const viewer = screen.getByRole('dialog', { name: 'Photo 3 of 4' });
    expect(within(viewer).getByRole('img', { name: 'Blurred photo 3 of 4' })).toHaveAttribute('src', PHOTOS[2]);
    expect(within(viewer).getByText('Faces and number plates are blurred.')).toBeInTheDocument();
    expect(within(viewer).getByRole('button', { name: 'Close photo' })).toHaveFocus();
  });
});

describe('PhotoViewer paging', () => {
  it('swipes and uses arrow keys to move between photos, stopping at the ends', async () => {
    await openSitePhoto(1);
    swipe(-150);
    expect(screen.getByRole('dialog', { name: 'Photo 2 of 4' })).toBeInTheDocument();
    swipe(150);
    expect(screen.getByRole('dialog', { name: 'Photo 1 of 4' })).toBeInTheDocument();
    swipe(150);
    expect(screen.getByRole('dialog', { name: 'Photo 1 of 4' })).toBeInTheDocument();
    fireEvent.keyDown(window, { key: 'ArrowRight' });
    fireEvent.click(screen.getByRole('button', { name: 'Next photo' }));
    expect(screen.getByRole('dialog', { name: 'Photo 3 of 4' })).toBeInTheDocument();
    fireEvent.keyDown(window, { key: 'ArrowLeft' });
    expect(screen.getByRole('dialog', { name: 'Photo 2 of 4' })).toBeInTheDocument();
  });
});

describe('PhotoViewer closing', () => {
  it('closes with the back button and pushes one history entry while open', async () => {
    const before = window.history.length;
    await openSitePhoto(2);
    expect(window.history.length).toBe(before + 1);
    act(() => window.history.back());
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('closes with the X, Escape and a swipe down, and gives focus back to the photo', async () => {
    await openSitePhoto(1);
    fireEvent.click(screen.getByRole('button', { name: 'Close photo' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Blurred photo 1 of 4' })).toHaveFocus();
    fireEvent.click(screen.getByRole('button', { name: 'Blurred photo 2 of 4' }));
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Blurred photo 2 of 4' }));
    swipe(0, 200);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('pops its history entry when the component under it unmounts while open', async () => {
    const view = await renderApp(<SitePanel site={testSite({ photo_urls: PHOTOS })} userLocation={null} />);
    fireEvent.click(screen.getByRole('button', { name: 'Blurred photo 1 of 4' }));
    expect(viewerOwnsTop()).toBe(true);
    view.unmount();
    await waitFor(() => expect(viewerOwnsTop()).toBe(false));
  });
});

describe('PhotoViewer dates', () => {
  it('says when a site photo was reported, read from its id, and shows no date without one', async () => {
    const reported = 'https://example.test/media/reports/rpt_01m4fnncj00000000000000000.jpg';
    await renderApp(<SitePanel site={testSite({ photo_urls: [reported, PHOTOS[0] ?? ''] })} userLocation={null} />);
    fireEvent.click(screen.getByRole('button', { name: 'Blurred photo 1 of 2' }));
    const viewer = screen.getByRole('dialog', { name: 'Photo 1 of 2' });
    expect(within(viewer).getByText(/^Reported 9 Oct 2026/)).toBeInTheDocument();
    expect(within(viewer).queryByText(/^Taken /)).not.toBeInTheDocument();
    fireEvent.click(within(viewer).getByRole('button', { name: 'Next photo' }));
    expect(within(screen.getByRole('dialog')).queryByText(/^Reported /)).not.toBeInTheDocument();
  });
});

describe('Other thumbnails open the viewer', () => {
  it('opens letter evidence photos', async () => {
    const text = { label: (_key: string, params: { n: number }) => `Evidence photo ${params.n}` } as unknown as LetterText;
    await renderApp(<EvidencePhotos urls={PHOTOS.slice(0, 2)} text={text} />);
    fireEvent.click(screen.getByRole('button', { name: 'Evidence photo 2' }));
    expect(screen.getByRole('dialog', { name: 'Photo 2 of 2' })).toBeInTheDocument();
  });

  it('opens Activity thumbnails with the phone capture time as "Taken", skipping reports with no blurred copy yet', async () => {
    const report = (n: number, blurred: string | null) =>
      QueuedReport.fromData({
        ...QueuedReport.capture(sampleDraft(String(n).repeat(64)), new ArrayBuffer(0), new Date()).data,
        stage: 'sent',
        status: { report_id: `rpt_${n}`, status: 'verified', site_id: null, blurred_url: blurred, updated_at: '2026-10-10T04:01:00Z' },
      });
    await renderApp(<ActivityReportList reports={[report(1, PHOTOS[0] ?? null), report(2, null), report(3, PHOTOS[1] ?? null)]} />);
    const thumbs = screen.getAllByRole('button', { name: 'Blurred photo of your report' });
    expect(thumbs).toHaveLength(2);
    fireEvent.click(thumbs[1] as HTMLElement);
    const viewer = screen.getByRole('dialog', { name: 'Photo 2 of 2' });
    expect(within(viewer).getByText(/^Taken /)).toBeInTheDocument();
  });
});
