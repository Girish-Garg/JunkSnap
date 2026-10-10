import { describe, expect, it } from 'vitest';
import scanSchema from '../../contracts/schemas/scan_session.schema.json';
import { QueuedScan } from '../src/domain/QueuedScan';
import type { ScanDraft, ScanFound, ScanStatusView } from '../src/domain/ScanUpload';
import { scanPlaces } from '../src/features/snap/hooks/useScanChoice';
import { ScanProgress } from '../src/features/snap/ScanProgress';
import { ScanTracker } from '../src/services/ScanTracker';
import { SAMPLE_FOUND } from './scanFakes';

const VIDEO = new TextEncoder().encode('video').buffer;
const DRAFT: ScanDraft = {
  report_type: 'auto', context: 'auto', started_at: '2026-10-10T04:00:00.000Z', ended_at: '2026-10-10T04:00:06.000Z',
  duration_ms: 6000, content_type: 'video/webm', video_sha256: 'c'.repeat(64), size_bytes: 5,
  gps_track: [{ t_ms: 0, lat: 26.26, lon: 73.0, accuracy_m: 8 }],
};
const UPLOAD = { scan_id: 'scn_1', upload_url: 'https://s3.test/x', headers: {}, expires_at: '2026-10-10T04:05:00Z' };

function posted(found: ScanFound | null | undefined, status: ScanStatusView['status'] = 'done'): QueuedScan {
  const view: ScanStatusView = { scan_id: 'scn_1', status, reason: null, frames: null, report_ids: [], updated_at: 'x', found };
  return QueuedScan.record(DRAFT, VIDEO, new Date()).presigned(UPLOAD, new Date()).uploaded().sent('scn_1').withStatus(view);
}

describe('area scout choice', () => {
  it('offers Auto first for every type a model can find, only Auto for a scout and none for no bin', () => {
    expect(scanPlaces('auto')).toEqual(['auto']);
    expect(scanPlaces('overflowing_bin')).toEqual(['auto', 'overflowing', 'damaged']);
    expect(scanPlaces('no_bin')).toEqual(['no_bin', 'no_pickup']);
  });

  it('posts auto as scan_session report_type and context, values the contract schema allows', () => {
    const session = QueuedScan.record(DRAFT, VIDEO, new Date()).presigned(UPLOAD, new Date()).toSession('d');
    expect(session).toMatchObject({ report_type: 'auto', context: 'auto' });
    expect(scanSchema.properties.report_type.enum).toContain('auto');
    expect(scanSchema.properties.context.enum).toContain('auto');
  });
});

describe('scan outcome', () => {
  it('counts sites by type in legend order, never created reports', () => {
    expect(ScanProgress.outcome(posted(SAMPLE_FOUND))).toEqual({
      kind: 'found', count: 2, parts: [{ type: 'waste_dump', count: 1 }, { type: 'overflowing_bin', count: 1 }],
    });
    expect(ScanProgress.outcome(posted({ ...SAMPLE_FOUND, sites: 0, by_type: {} }))).toEqual({ kind: 'nothing' });
    expect(ScanProgress.outcome(posted({ ...SAMPLE_FOUND, checking: 3 }))).toEqual({ kind: 'checking', count: 3 });
  });

  it('shows nothing before the worker is done or from an api without found', () => {
    expect(ScanProgress.outcome(posted(null, 'processing'))).toBeNull();
    expect(ScanProgress.outcome(posted(undefined))).toBeNull();
    expect(ScanProgress.frames(posted(null, 'processing'))).toEqual([]);
  });

  it('keeps polling a done scan while its frames are still being checked', () => {
    expect(ScanTracker.isOpen(posted(null, 'processing'))).toBe(true);
    expect(ScanTracker.isOpen(posted({ ...SAMPLE_FOUND, checking: 2 }))).toBe(true);
    expect(ScanTracker.isOpen(posted(SAMPLE_FOUND))).toBe(false);
    expect(ScanTracker.isOpen(posted(null, 'failed'))).toBe(false);
  });
});
