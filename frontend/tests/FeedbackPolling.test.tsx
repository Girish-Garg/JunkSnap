import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ServicesContext } from '../src/app/ServicesContext';
import { ApiError } from '../src/domain/ApiError';
import type { ReportStatus, ReportStatusView } from '../src/domain/ReportStatus';
import { FeedbackPolling } from '../src/features/activity/FeedbackPolling';
import { useReportFeedback } from '../src/features/activity/hooks/useReportFeedback';
import { DEFAULTS } from './config';
import { FakeReportApi } from './FakeReportApi';
import { MemoryStore, testServices } from './helpers';

const STEP = DEFAULTS.cache.feedbackPollMs;

/** Answers each GET /reports/{id} with the next scripted status or error; the last one repeats. */
class ScriptedApi extends FakeReportApi {
  readonly #script: (ReportStatus | ApiError)[];
  reads = 0;

  constructor(script: (ReportStatus | ApiError)[]) {
    super();
    this.#script = script;
  }

  override async status(reportId: string): Promise<ReportStatusView> {
    const next = this.#script[Math.min(this.reads, this.#script.length - 1)];
    this.reads += 1;
    if (next === undefined || next instanceof ApiError) throw next ?? new ApiError(500, 'server_error', 'empty script');
    return { report_id: reportId, status: next, site_id: null, blurred_url: null, updated_at: '2026-10-10T04:01:00Z' };
  }
}

function polling(script: (ReportStatus | ApiError)[]) {
  const api = new ScriptedApi(script);
  const services = testServices(new MemoryStore(), { api });
  const wrapper = ({ children }: { children: ReactNode }) => <ServicesContext.Provider value={services}>{children}</ServicesContext.Provider>;
  const hook = renderHook(() => useReportFeedback('rpt_poll'), { wrapper });
  return { api, hook, tick: (ms = STEP) => act(() => vi.advanceTimersByTimeAsync(ms)) };
}

const offline = () => new ApiError(503, 'server_error', 'offline');

beforeEach(() => {
  vi.useFakeTimers();
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('useReportFeedback polling', () => {
  it('reads again every 5 s while the report is being checked, and stops at a final status', async () => {
    const { api, hook, tick } = polling(['queued', 'processing', 'verified']);
    await tick(0);
    expect(api.reads).toBe(1);
    await tick();
    expect(api.reads).toBe(2);
    await tick();
    expect(api.reads).toBe(3);
    expect(hook.result.current.view?.status).toBe('verified');
    for (let i = 0; i < 3; i += 1) await tick();
    expect(api.reads).toBe(3);
  });

  it('keeps polling after a failed second read, and recovers', async () => {
    const { api, hook, tick } = polling(['processing', offline(), 'processing', 'unverified']);
    await tick(0);
    await tick();
    expect(api.reads).toBe(2);
    expect(hook.result.current).toMatchObject({ failed: false, view: { status: 'processing' } });
    await tick();
    await tick();
    expect(api.reads).toBe(4);
    expect(hook.result.current.view?.status).toBe('unverified');
  });
});

describe('useReportFeedback polling stops', () => {
  it('stops reading once unmounted', async () => {
    const { api, hook, tick } = polling(['processing']);
    await tick(0);
    hook.unmount();
    for (let i = 0; i < 3; i += 1) await tick();
    expect(api.reads).toBe(1);
  });
});

describe('useReportFeedback polling after errors', () => {
  it.each([404, 403])('never asks again after a %i', async (status) => {
    const { api, hook, tick } = polling([new ApiError(status, 'not_found', 'not yours')]);
    await tick(0);
    for (let i = 0; i < 3; i += 1) await tick();
    expect(api.reads).toBe(1);
    expect(hook.result.current.failed).toBe(true);
  });

  it('gives up after a few failed reads in a row', async () => {
    const { api, hook, tick } = polling([offline()]);
    await tick(0);
    for (let i = 0; i < 6; i += 1) await tick();
    expect(api.reads).toBe(FeedbackPolling.MAX_FAILURES);
    expect(hook.result.current.failed).toBe(true);
  });
});
