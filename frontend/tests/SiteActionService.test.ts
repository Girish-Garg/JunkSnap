import { describe, expect, it } from 'vitest';
import { GpsWatcher } from '../src/services/GpsWatcher';
import { SiteActionService } from '../src/services/SiteActionService';
import { FakeReportApi } from './FakeReportApi';
import { FakeSiteActionsApi } from './FakeSiteActionsApi';
import { DEVICE_TOKEN, fixedGeolocation, fixedIdentity } from './snapFakes';

const GPS = { lat: 26.26183, lon: 73.00352, accuracy_m: 6 };

function setup(idToken: string | null = 'id-token') {
  const api = new FakeSiteActionsApi();
  const uploads = new FakeReportApi();
  const service = new SiteActionService({ api, uploads, identity: fixedIdentity(idToken), gps: new GpsWatcher(fixedGeolocation()) });
  return { api, uploads, service };
}

describe('SiteActionService', () => {
  it('votes with the device token and a fresh GPS fix', async () => {
    const { api, service } = setup();
    await service.vote('site_jpr_1', 'confirm');
    expect(api.calls[0]).toEqual({ kind: 'vote', siteId: 'site_jpr_1', body: { device_token: DEVICE_TOKEN, vote: 'confirm', gps: GPS } });
  });

  it('presigns the after-photo as a cleanup, PUTs it, then claims the cleanup with that upload id', async () => {
    const { api, uploads, service } = setup();
    const photo = { bytes: new ArrayBuffer(3), sha256: 'd'.repeat(64), gps: GPS, capturedAt: '2026-10-10T05:00:00Z' };
    await expect(service.cleanup('site_jdh_1', photo)).resolves.toMatchObject({ cleanup_id: 'cln_test_1', status: 'checking' });
    expect(uploads.bodies('presign')[0]).toEqual({ purpose: 'cleanup', content_type: 'image/jpeg', sha256: 'd'.repeat(64), device_token: DEVICE_TOKEN });
    expect(uploads.count('put')).toBe(1);
    expect(api.calls[0]?.body).toEqual({ upload_id: 'upl_test_1', device_token: DEVICE_TOKEN, sha256: 'd'.repeat(64), gps: GPS, captured_at: '2026-10-10T05:00:00Z' });
  });

  it('asks for a local body letter in the chosen language', async () => {
    const { api, service } = setup();
    const draft = await service.letter('site_jdh_1', 'hi');
    expect(api.calls[0]?.body).toEqual({ device_token: DEVICE_TOKEN, channel: 'local_body', language: 'hi' });
    expect(draft.language).toBe('hi');
  });

  it('sends nothing without a sign-in token', async () => {
    const { api, service } = setup(null);
    await expect(service.letter('site_jdh_1', 'en')).rejects.toMatchObject({ problem: 'wrong_credentials' });
    expect(api.calls).toEqual([]);
  });
});
