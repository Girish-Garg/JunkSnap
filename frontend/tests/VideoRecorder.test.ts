import { afterEach, describe, expect, it, vi } from 'vitest';
import { SCAN_LIMITS } from '../src/domain/ScanUpload';
import { AUTO_STOP_MS } from '../src/services/RecordingSession';
import { VIDEO_BITS_PER_SECOND, VideoRecorder } from '../src/services/VideoRecorder';
import { FakeMediaRecorder, fakeRecorderFactory } from './scanFakes';
import { FakeClock } from './snapFakes';

const STREAM = {} as MediaStream;

afterEach(() => {
  vi.useRealTimers();
  FakeMediaRecorder.supported = ['video/webm;codecs=vp8', 'video/webm'];
});

describe('VideoRecorder type and bitrate', () => {
  it('prefers MP4 where the browser records it and sends the type without codecs', () => {
    FakeMediaRecorder.supported = ['video/mp4;codecs=avc1', 'video/webm'];
    const recorder = new VideoRecorder(fakeRecorderFactory, new FakeClock());
    expect(recorder.pickType()).toBe('video/mp4;codecs=avc1');
    recorder.start(STREAM);
    expect(FakeMediaRecorder.last?.options).toEqual({ mimeType: 'video/mp4;codecs=avc1', videoBitsPerSecond: VIDEO_BITS_PER_SECOND });
    expect(VideoRecorder.baseType('video/webm;codecs=vp8')).toBe('video/webm');
  });

  it('keeps a full minute well under 40 MB', () => {
    expect((VIDEO_BITS_PER_SECOND / 8) * (SCAN_LIMITS.maxDurationMs / 1000)).toBeLessThan(SCAN_LIMITS.maxBytes / 2);
  });

  it('says when the browser cannot record', () => {
    expect(new VideoRecorder(undefined, new FakeClock()).isSupported()).toBe(false);
  });
});

describe('RecordingSession limits', () => {
  it('stops by itself just before 60 s', async () => {
    vi.useFakeTimers();
    const clock = new FakeClock();
    const session = new VideoRecorder(fakeRecorderFactory, clock).start(STREAM);
    clock.advance(AUTO_STOP_MS);
    vi.advanceTimersByTime(AUTO_STOP_MS);
    const recording = await session.finished;
    expect(recording.durationMs).toBe(AUTO_STOP_MS);
    expect(recording.contentType).toBe('video/webm');
  });

  it('stops early once the chunks near 40 MB', () => {
    const session = new VideoRecorder(fakeRecorderFactory, new FakeClock()).start(STREAM);
    void session.finished.catch(() => undefined);
    FakeMediaRecorder.last?.ondataavailable?.({ data: { size: 39 * 1024 * 1024 } as Blob } as BlobEvent);
    expect(FakeMediaRecorder.last?.state).toBe('inactive');
  });

  it('refuses a recording shorter than a second', async () => {
    const session = new VideoRecorder(fakeRecorderFactory, new FakeClock()).start(STREAM);
    session.stop();
    await expect(session.finished).rejects.toMatchObject({ problem: 'video_too_short' });
  });
});
