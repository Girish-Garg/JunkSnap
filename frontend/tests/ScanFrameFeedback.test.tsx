import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { AppRoutes } from '../src/app/AppRoutes';
import type { FrameFinding, ScanFound } from '../src/domain/ScanUpload';
import { MockReportApi } from '../src/services/MockReportApi';
import { MockReportEvidence } from '../src/services/MockReportEvidence';
import { reportEvidenceLoaders } from '../src/services/reportFixtures';
import { sampleSiteLoader } from '../src/services/siteFixtures';
import { MemoryStore, renderApp, testServices } from './helpers';
import { FakeScanApi } from './scanFakes';
import { FakeClock } from './snapFakes';

vi.mock('../src/features/map/components/SiteMapView', () => ({ SiteMapView: () => null }));

const frame = (i: number, result: FrameFinding['result'], site_id: string | null): FrameFinding => ({
  report_id: `rpt_frame_${i}`,
  t_ms: i * 1000,
  result,
  report_type: 'waste_dump',
  site_id,
  blurred_url: null,
});

// One frame waits in the jpr-1 sample site (2 of 10 backers), one repeats it, one is not waste.
const FOUND: ScanFound = {
  sites: 1,
  by_type: { waste_dump: 1 },
  checking: 0,
  frames: [frame(0, 'waiting', 'site_jpr_1'), frame(1, 'skipped', null), frame(2, 'not_waste', null)],
};

async function scanInActivity() {
  const user = userEvent.setup();
  const clock = new FakeClock();
  const evidence = new MockReportEvidence(reportEvidenceLoaders);
  evidence.noteFrames(FOUND.frames);
  const scanApi = new FakeScanApi();
  scanApi.found = FOUND;
  const services = testServices(new MemoryStore(), { scanApi, clock, api: new MockReportApi(sampleSiteLoader, 0, evidence) });
  await services.auth.signUp('resident@example.com', 'jodhpur2026');
  await services.auth.confirmSignUp('resident@example.com', '123456');
  await renderApp(<AppRoutes />, { route: '/snap', services });
  await user.click(screen.getByRole('button', { name: 'Video' }));
  const record = await screen.findByRole('button', { name: 'Start recording' });
  await waitFor(() => expect(record).toBeEnabled());
  await user.click(record);
  clock.advance(3_000);
  await user.click(screen.getByRole('button', { name: 'Stop recording' }));
  await screen.findByText('Found 1: 1 dump');
  await user.click(screen.getByRole('button', { name: 'See all in Activity' }));
  const videos = await screen.findByRole('list', { name: 'Videos' });
  return { user, strip: within(within(videos).getByRole('list', { name: 'Frames from this video' })) };
}

describe('What we checked, for a scan frame', () => {
  it('opens a not-waste frame with the disagreeing AI check and retake tips, then a waiting frame with its count and share', async () => {
    const { user, strip } = await scanInActivity();
    await user.click(strip.getByRole('button', { name: /Frame at 2 s/ }));
    expect(await screen.findByText('Not a waste site')).toBeInTheDocument();
    expect(screen.getByText('AI check disagreed')).toBeInTheDocument();
    expect(screen.getByText("The AI check didn't see the reported problem in this photo.")).toBeInTheDocument();
    expect(screen.getByText('Think this is wrong?')).toBeInTheDocument();
    expect(screen.getByText('Step closer, so the waste fills most of the picture.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Close what we checked' }));
    const again = within(await screen.findByRole('list', { name: 'Frames from this video' }));
    await user.click(again.getByRole('button', { name: /Frame at 0 s/ }));
    expect(await screen.findByText('On the map, waiting for neighbours (2 of 10)')).toBeInTheDocument();
    expect(screen.getByText('AI check (gpt-4.1-mini on OpenAI)')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Think this is wrong? Ask neighbours to check' }));
    expect(await screen.findByText('Link copied')).toBeInTheDocument();
  });

  it('explains a repeat view that the photo checks stopped', async () => {
    const { user, strip } = await scanInActivity();
    await user.click(strip.getByRole('button', { name: /Frame at 1 s/ }));
    expect(await screen.findByText('Stopped at the photo checks')).toBeInTheDocument();
    expect(screen.getByText('It repeats an earlier photo of the same view.')).toBeInTheDocument();
    expect(screen.getByText('Stopped before blurring, so never shown')).toBeInTheDocument();
    expect(screen.queryByText(/AI check \(/)).not.toBeInTheDocument();
  });
});
