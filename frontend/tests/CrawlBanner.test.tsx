import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { CrawlProgress, type AreaCrawl } from '../src/domain/AreaCrawl';
import { CrawlBanner } from '../src/features/areas/components/CrawlBanner';
import { renderApp } from './helpers';

const COLLECTING = /We're collecting official ward data for this area/;

const queued: AreaCrawl = {
  ...CrawlProgress.notStarted('rajasthan-jodhpur'),
  status: 'queued',
  queued_at: '2026-10-10T09:12:40Z',
  next_due_at: '2026-10-10T09:12:40Z',
  expected_by: '2026-10-10T11:12:40Z',
};

describe('CrawlBanner', () => {
  it('shows a queued crawl with the time ward data is expected by', async () => {
    await renderApp(<CrawlBanner crawl={queued} />);
    const banner = screen.getByRole('status');
    expect(banner).toHaveTextContent(COLLECTING);
    expect(banner).toHaveTextContent(/Expected by 10 Oct 2026, 4:42\s?pm/i);
  });

  it('reads in Hindi', async () => {
    await renderApp(<CrawlBanner crawl={queued} />, { language: 'hi' });
    expect(screen.getByRole('status')).toHaveTextContent(/हम इस क्षेत्र का आधिकारिक वार्ड डेटा जुटा रहे हैं।/);
    expect(screen.getByRole('status')).toHaveTextContent(/अनुमानित समय:/);
  });

  it('leaves out the expected line when there is no expected time', async () => {
    await renderApp(<CrawlBanner crawl={CrawlProgress.notStarted('rajasthan-jaipur')} />);
    expect(screen.getByRole('status')).toHaveTextContent(COLLECTING);
    expect(screen.queryByText(/Expected by/)).not.toBeInTheDocument();
  });

  it('hides once the crawl is done, and while there is no crawl', async () => {
    const done: AreaCrawl = { ...queued, status: 'done', expected_by: null, wards_found: 65 };
    await renderApp(<CrawlBanner crawl={done} />);
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    await renderApp(<CrawlBanner crawl={null} />);
    expect(screen.queryByText(COLLECTING)).not.toBeInTheDocument();
  });
});
