import { describe, expect, it } from 'vitest';
import scanSchema from '../../contracts/schemas/scan_session.schema.json';
import type { Detection, FrameDetections } from '../src/domain/EdgeModel';
import { QueuedScan } from '../src/domain/QueuedScan';
import type { ScanDraft } from '../src/domain/ScanUpload';
import { ScanHintLog } from '../src/services/ScanHintLog';

const BOX = { left: 0.1, top: 0.2, width: 0.3, height: 0.4 };
const found = (label: Detection['label'], score: number): Detection => ({ label, score, box: BOX });
const frame = (capturedAtMs: number, ...detections: Detection[]): FrameDetections => ({ detections, capturedAtMs, inferenceMs: 30 });

describe('ScanHintLog', () => {
  it('keeps the strongest waste box of each frame, timed from the start of the video', () => {
    const log = new ScanHintLog('yolo26n-320-int8-v1');
    log.begin(10_000);
    log.add(frame(10_250, found('waste_pile', 0.8), found('bag', 0.5)));
    log.add(frame(10_500, found('bin', 0.95)));
    log.add(frame(10_750, found('bag', 0.2)));
    expect(log.hints(6_000)).toEqual({ model: 'yolo26n-320-int8-v1', detections: [{ t_ms: 250, score: 0.8, box: BOX }] });
  });

  it('ignores frames before begin, before t 0 or past the video, and returns null when nothing was spotted', () => {
    const log = new ScanHintLog('m');
    log.add(frame(1_000, found('waste_pile', 0.9)));
    log.begin(5_000);
    log.add(frame(4_000, found('waste_pile', 0.9)));
    log.add(frame(12_000, found('waste_pile', 0.9)));
    expect(log.hints(6_000)).toBeNull();
  });
});

function draft(hints?: ScanDraft['hints']): ScanDraft {
  const base: ScanDraft = {
    report_type: 'waste_dump', context: 'roadside', started_at: '2026-10-10T04:00:00.000Z', ended_at: '2026-10-10T04:00:06.000Z',
    duration_ms: 6000, content_type: 'video/webm', video_sha256: 'c'.repeat(64), size_bytes: 5, gps_track: [{ t_ms: 0, lat: 26.26, lon: 73, accuracy_m: 8 }],
  };
  return hints ? { ...base, hints } : base;
}

function session(scanDraft: ScanDraft) {
  const upload = { scan_id: 'scn_test_1', upload_url: 'https://x', headers: {}, expires_at: '2026-10-10T05:00:00Z' };
  return QueuedScan.record(scanDraft, new ArrayBuffer(5), new Date()).presigned(upload, new Date()).toSession('d');
}

describe('scan_session body', () => {
  it('cloud mode: no hints key at all, exactly as before the model', () => {
    expect(session(draft())).not.toHaveProperty('hints');
  });

  it('edge mode: hints with only the fields the schema allows', () => {
    const body = session(draft({ model: 'yolo26n-320-int8-v1', detections: [{ t_ms: 250, score: 0.8, box: BOX }] }));
    const hintSchema = scanSchema.properties.hints;
    expect(Object.keys(body.hints ?? {}).sort()).toEqual([...hintSchema.required].sort());
    const item = body.hints?.detections[0] ?? {};
    expect(Object.keys(item).sort()).toEqual([...hintSchema.properties.detections.items.required].sort());
  });
});
