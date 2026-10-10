import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { AppRoutes } from '../src/app/AppRoutes';
import type { ServiceContainer } from '../src/app/ServiceContainer';
import { QueuedReport } from '../src/domain/QueuedReport';
import type { ReportStatus } from '../src/domain/ReportStatus';
import { ReportProgress } from '../src/features/snap/ReportProgress';
import { RelativeTime } from '../src/i18n/RelativeTime';
import { MemoryStore, renderApp, testServices } from './helpers';
import { MemoryReportStore, sampleDraft } from './snapFakes';

vi.mock('../src/features/map/components/SiteMapView', () => ({ SiteMapView: () => null }));

const NOW = new Date('2026-10-10T04:00:00Z');

function sent(status: ReportStatus, siteId: string | null): QueuedReport {
  const view = { report_id: 'rpt_mine', status, site_id: siteId, blurred_url: 'https://cdn.test/media/reports/rpt_mine.jpg', updated_at: '2026-10-10T04:01:00Z' };
  return QueuedReport.capture(sampleDraft(), new ArrayBuffer(1), NOW).sent('rpt_mine').withStatus(view);
}

async function activity(reports: readonly QueuedReport[]): Promise<ServiceContainer> {
  const store = new MemoryReportStore();
  for (const report of reports) await store.put(report.data);
  const services = testServices(new MemoryStore(), { store });
  await services.auth.signUp('resident@example.com', 'jodhpur2026');
  await services.auth.confirmSignUp('resident@example.com', '123456');
  await renderApp(<AppRoutes />, { route: '/activity', services });
  return services;
}

describe('an Activity card', () => {
  it('puts the thumbnail beside the title, a relative time with the full date on hover, and the status pill', async () => {
    await activity([sent('unverified', 'site_jdh_1')]);
    const card = within(await screen.findByRole('list', { name: 'Photos' })).getByRole('listitem');
    const head = card.querySelector('.activity-card__head');
    expect(head?.firstElementChild).toHaveAttribute('title', 'Open photo');
    expect(head?.lastElementChild?.firstElementChild).toHaveTextContent('Waste dump');
    expect(within(card).getByText('Waste dump')).toBeInTheDocument();
    const time = card.querySelector('time');
    expect(time?.getAttribute('dateTime')).toBe('2026-10-10T04:00:00Z');
    expect(time?.getAttribute('title')).toMatch(/10 Oct 2026/);
    expect(within(card).getByText('Waiting for 10 people to confirm')).toHaveClass('badge--progress-wait');
  });

  it('makes What we checked the main action and Delete a small trash button, all in one row', async () => {
    await activity([sent('verified', 'site_jdh_1')]);
    const card = within(await screen.findByRole('list', { name: 'Photos' })).getByRole('listitem');
    const actions = card.querySelector('.activity-card__actions');
    if (!(actions instanceof HTMLElement)) throw new Error('no action row');
    expect(within(actions).getByRole('button', { name: 'What we checked' })).toHaveClass('button--tonal');
    expect(within(actions).getByRole('button', { name: 'Open site' })).toHaveClass('button--text');
    const remove = within(actions).getByRole('button', { name: 'Delete' });
    expect(remove).toHaveClass('icon-button');
    expect(remove).not.toHaveClass('button--primary');
  });
});

describe('an Activity status pill', () => {
  it('colours the status by state', () => {
    const tone = (status: ReportStatus) => ReportProgress.of(sent(status, null)).tone;
    expect([tone('unverified'), tone('verified'), tone('withdrawn'), tone('processing')]).toEqual(['wait', 'good', 'muted', 'wait']);
  });
});

describe('an empty Activity', () => {
  it('offers to take the first photo', async () => {
    const user = userEvent.setup();
    await activity([]);
    await user.click(await screen.findByRole('button', { name: 'Take your first photo' }));
    expect(await screen.findByRole('heading', { name: 'Report a waste site' })).toBeInTheDocument();
  });
});

describe('relative times', () => {
  const now = Date.parse('2026-10-10T04:00:00Z');

  it.each([
    ['2026-10-10T03:59:40Z', 'now'],
    ['2026-10-10T03:58:00Z', '2 min ago'],
    ['2026-10-10T01:00:00Z', '3 hr ago'],
    ['2026-10-09T03:00:00Z', 'yesterday'],
    ['2026-10-01T03:00:00Z', '1 Oct'],
    ['2026-10-10T04:05:00Z', 'now'],
  ])('reads %s as "%s" in English', (at, expected) => {
    expect(new RelativeTime('en-IN').format(at, now)).toBe(expected);
  });

  it('reads in Hindi too', () => {
    expect(new RelativeTime('hi-IN').format('2026-10-10T03:58:00Z', now)).toBe('2 मिनट पहले');
  });
});
