import { describe, expect, it } from 'vitest';
import { BinAccess } from '../src/domain/BinAccess';
import type { AcceptedReport, NoBinUpload, PresignResponse, ReportUpload } from '../src/domain/ReportUpload';
import type { ReportListPage } from '../src/domain/ReportList';
import type { ReportStatusView } from '../src/domain/ReportStatus';
import type { QueuedReport } from '../src/domain/QueuedReport';
import { NoBinReporter } from '../src/services/NoBinReporter';
import type { ReportApi, RequestIdentity } from '../src/services/ReportApi';
import ZonesLayer from '../src/layers/ZonesLayer';

class RecordingReportApi implements ReportApi {
  readonly sent: (ReportUpload | NoBinUpload)[] = [];

  presign(): Promise<PresignResponse> {
    throw new Error('a no-bin report without a photo never presigns');
  }

  putPhoto(): Promise<void> {
    throw new Error('a no-bin report without a photo never uploads');
  }

  async submit(upload: ReportUpload | NoBinUpload): Promise<AcceptedReport> {
    this.sent.push(upload);
    return { report_id: upload.upload_id.replace(/^upl_/, 'rpt_'), status: 'queued' };
  }

  status(): Promise<ReportStatusView> {
    throw new Error('not used');
  }

  confirm(): Promise<ReportStatusView> {
    throw new Error('a no-bin report is never asked to confirm');
  }

  mine(): Promise<ReportListPage> {
    throw new Error('not used');
  }
}

const signedIn: RequestIdentity = { idToken: async () => 'token', deviceToken: async () => '3f6c2a1e-8b4d-4c7a-9e21-5d0b7f3a6c14' };
const random = () => new Uint8Array(16).fill(7);

describe('No bin here', () => {
  it('sends a photo-less no_bin report from a fix of 50 m or better', async () => {
    const api = new RecordingReportApi();
    const accepted = await new NoBinReporter(api, signedIn, random).report({ lat: 26.3, lon: 73.03, accuracy_m: 12 }, new Date('2026-10-10T10:00:00.400Z'));
    const [upload] = api.sent;
    expect(upload).toEqual({
      upload_id: expect.stringMatching(/^upl_[0-9a-z]{26}$/),
      report_type: 'no_bin',
      context: 'no_bin',
      capture_mode: 'snap',
      gps: { lat: 26.3, lon: 73.03, accuracy_m: 12 },
      captured_at: '2026-10-10T10:00:00Z',
      device_token: '3f6c2a1e-8b4d-4c7a-9e21-5d0b7f3a6c14',
    });
    expect(upload).not.toHaveProperty('sha256');
    expect(accepted.status).toBe('queued');
  });

  it('refuses a vague fix and asks a guest to sign in first', async () => {
    const api = new RecordingReportApi();
    await expect(new NoBinReporter(api, signedIn, random).report({ lat: 26.3, lon: 73.03, accuracy_m: 80 })).rejects.toThrow(RangeError);
    const guest: RequestIdentity = { ...signedIn, idToken: async () => null };
    await expect(new NoBinReporter(api, guest, random).report({ lat: 26.3, lon: 73.03, accuracy_m: 10 })).rejects.toThrow('Sign in');
    expect(api.sent).toEqual([]);
    expect(NoBinReporter.accurateEnough(null)).toBe(false);
  });
});

describe('No bin here in Activity', () => {
  it('keeps the accepted report as a sent Activity row keyed by its report id, as the server list does', async () => {
    const saved: QueuedReport[] = [];
    const recorder = { save: async (item: QueuedReport) => void saved.push(item) };
    const accepted = await new NoBinReporter(new RecordingReportApi(), signedIn, random, recorder).report({ lat: 26.3, lon: 73.03, accuracy_m: 12 }, new Date('2026-10-10T10:00:00Z'));
    const [row] = saved;
    expect(row?.id).toBe(accepted.report_id);
    expect(row?.data).toMatchObject({ stage: 'sent', report_id: accepted.report_id, photo: null, saved_at: '2026-10-10T10:00:00.000Z' });
    expect(row?.data.draft).toMatchObject({ report_type: 'no_bin', context: 'no_bin', captured_at: '2026-10-10T10:00:00Z' });
    expect(row?.isPending()).toBe(false);
  });

  it('still reports the send when the phone cannot keep the row', async () => {
    const recorder = { save: async () => Promise.reject(new Error('quota')) };
    const accepted = await new NoBinReporter(new RecordingReportApi(), signedIn, random, recorder).report({ lat: 26.3, lon: 73.03, accuracy_m: 12 });
    expect(accepted.status).toBe('queued');
  });
});

describe('no-bin zones on the map and the sheet', () => {
  it('shows a mapped bin within 1 km of a zone as evidence, and a far one as the nearest bin', () => {
    expect(BinAccess.zoneLine({ distance_m: 420 }, false)).toEqual({ key: 'mappedNear', metres: 420 });
    expect(BinAccess.zoneLine({ distance_m: 4210 }, true)).toEqual({ key: 'nearest', metres: 4210 });
    expect(BinAccess.zoneLine(null, null)).toEqual({ key: 'notMapped' });
  });

  it('draws only no-bin zones, as a 1 km circle that grows with the zoom', () => {
    const spec = new ZonesLayer().spec({ sourceId: 'sites', pinSourceId: 'site-pins', mode: 'pins', selectedId: null });
    expect(spec).toMatchObject({ type: 'circle', filter: ['==', ['get', 'report_type'], 'no_bin'] });
    const radius = (spec as { paint: { 'circle-radius': unknown[] } }).paint['circle-radius'];
    expect(radius.slice(0, 3)).toEqual(['interpolate', ['exponential', 2], ['zoom']]);
  });
});
