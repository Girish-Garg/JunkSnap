import { describe, expect, it } from 'vitest';
import { areaFixtureLoaders } from '../src/services/areaFixtures';
import { crawlFixtureLoaders } from '../src/services/crawlFixtures';
import { HttpAreaApi } from '../src/services/HttpAreaApi';
import { MockAreaApi } from '../src/services/MockAreaApi';
import { siteFixtureLoaders } from '../src/services/siteFixtures';

const mock = () => new MockAreaApi(areaFixtureLoaders, siteFixtureLoaders, crawlFixtureLoaders);

describe('MockAreaApi', () => {
  it('returns the fixture row for an area that has one', async () => {
    const scores = await mock().scores('assembly', 's20-ac-128');
    expect(scores.counts.verified_reports).toBe(14);
    expect(scores.scores.city).toEqual({ value: 41, reason: null });
  });

  it('returns the worker zero row for an area with sites but no score yet', async () => {
    const scores = await mock().scores('assembly', 's20-ac-127');
    expect(scores.area).toEqual({ kind: 'assembly', id: 's20-ac-127', name: 'Sardarpura' });
    expect(scores.counts.verified_reports).toBe(0);
    expect(Object.values(scores.scores)).toEqual(Array(3).fill({ value: null, reason: 'too_few_reports' }));
    expect(scores.diagnosis).toEqual([]);
    expect(scores.insights).toBeUndefined();
  });

  it('rejects an area with no sites with area_not_found', async () => {
    await expect(mock().scores('ward', 'jodhpur-mc-w99')).rejects.toMatchObject({ status: 404, code: 'area_not_found' });
  });
});

describe('MockAreaApi crawl', () => {
  it('returns the area_crawl fixture for Jodhpur district', async () => {
    const crawl = await mock().crawl('rajasthan-jodhpur');
    expect(crawl).toMatchObject({ district_id: 'rajasthan-jodhpur', status: 'queued', expected_by: '2026-10-10T11:12:40Z' });
  });

  it('answers not_started for a district with no crawl', async () => {
    expect(await mock().crawl('rajasthan-jaipur')).toEqual({
      district_id: 'rajasthan-jaipur',
      status: 'not_started',
      queued_at: null,
      last_crawled_at: null,
      next_due_at: null,
      expected_by: null,
      wards_found: null,
    });
  });
});

describe('HttpAreaApi', () => {
  it('calls GET /areas/{kind}/{id}/scores and maps errors to their contract code', async () => {
    const calls: string[] = [];
    const notFound: typeof fetch = async (input) => {
      calls.push(String(input));
      return new Response(JSON.stringify({ error: 'area_not_found', message: 'No sites' }), { status: 404 });
    };
    const api = new HttpAreaApi('https://api.example.test/', notFound);
    await expect(api.scores('district', 'rajasthan-jodhpur')).rejects.toMatchObject({ code: 'area_not_found' });
    expect(calls).toEqual(['https://api.example.test/areas/district/rajasthan-jodhpur/scores']);
  });

  it('calls GET /areas/district/{id}/crawl without a token', async () => {
    const calls: { url: string; init?: RequestInit }[] = [];
    const ok: typeof fetch = async (input, init) => {
      calls.push({ url: String(input), init });
      return new Response(JSON.stringify({ district_id: 'rajasthan-jodhpur', status: 'done' }), { status: 200 });
    };
    const crawl = await new HttpAreaApi('https://api.example.test', ok).crawl('rajasthan-jodhpur');
    expect(crawl.status).toBe('done');
    expect(calls[0]?.url).toBe('https://api.example.test/areas/district/rajasthan-jodhpur/crawl');
    expect(new Headers(calls[0]?.init?.headers).has('Authorization')).toBe(false);
  });
});
