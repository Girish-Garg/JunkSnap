import { expect, it } from 'vitest';
import { CaptureError } from '../src/domain/CaptureError';
import { FrameCounter } from '../src/services/FrameCounter';
import { LiveCamera, MAX_RESTARTS, type CameraEvent, type CameraState } from '../src/services/LiveCamera';
import { FakePage, FakeScreen, ManualTimer, fakeStream, settle } from './cameraFakes';

type Opening = MediaStream | CaptureError;

// Each getUserMedia call takes the next entry; the last one repeats.
function rig(openings: (call: number) => Opening, withFrames = true, recording = { on: false, lost: 0 }) {
  const timer = new ManualTimer();
  const page = new FakePage();
  const screen = new FakeScreen();
  const states: CameraState[] = [];
  const events: CameraEvent[] = [];
  const streams: MediaStream[] = [];
  let calls = 0;
  const open = async () => {
    const next = openings(calls++);
    if (next instanceof CaptureError) throw next;
    streams.push(next);
    return next;
  };
  const frames = withFrames ? FrameCounter.for(screen) : null;
  const view = {
    screen,
    frames,
    onState: (state: CameraState) => states.push(state),
    onEvent: (event: CameraEvent) => events.push(event),
    holding: () => recording.on,
    onLost: () => (recording.lost += 1),
  };
  const camera = new LiveCamera({ open, page, timer, now: () => timer.now }, view);
  return { camera, timer, page, screen, states, events, streams, recording, calls: () => calls };
}

const fresh = () => fakeStream();
const busy = () => new CaptureError('camera_unavailable', 'NotReadableError: camera in use');

// Frames every 100 ms for the given time, as a working camera delivers them.
function deliver(test: ReturnType<typeof rig>, ms: number): void {
  for (let spent = 0; spent < ms; spent += 100) {
    test.screen.present();
    test.timer.advance(100);
  }
}

it('LiveCamera: shows the stream and leaves it alone while frames arrive', async () => {
  const test = rig(fresh);
  test.camera.start();
  await settle();
  deliver(test, 10_000);
  expect(test.states).toEqual(['live']);
  expect(test.screen.srcObject).toBe(test.streams[0]);
  expect(test.screen.plays).toBe(1);
  expect(test.calls()).toBe(1);
});

it('LiveCamera: opens the camera again when a visible viewfinder gets no frame for 2 s (the Android freeze)', async () => {
  const test = rig(fresh);
  test.camera.start();
  await settle();
  deliver(test, 1_000);
  test.timer.advance(1_900);
  expect(test.calls()).toBe(1);
  test.timer.advance(600);
  await settle();
  expect(test.events).toEqual(['stalled']);
  expect(test.calls()).toBe(2);
  expect((test.streams[0] as ReturnType<typeof fakeStream>).track.stopped).toBe(true);
  expect(test.screen.srcObject).toBe(test.streams[1]);
  expect(test.states).toEqual(['live', 'starting', 'live']);
});

it('LiveCamera: does not judge a hidden page, and plays again with a fresh 2 s when it returns', async () => {
  const test = rig(fresh);
  test.camera.start();
  await settle();
  test.page.set(false);
  test.timer.advance(60_000);
  expect(test.calls()).toBe(1);
  test.page.set(true);
  await settle();
  expect(test.screen.plays).toBe(2);
  test.timer.advance(1_500);
  expect(test.calls()).toBe(1);
  test.timer.advance(1_000);
  expect(test.events).toEqual(['stalled']);
});

it('LiveCamera: opens the camera again as soon as the track ends', async () => {
  const test = rig(fresh);
  test.camera.start();
  await settle();
  deliver(test, 500);
  (test.streams[0] as ReturnType<typeof fakeStream>).track.end();
  test.timer.advance(500);
  await settle();
  expect(test.events).toEqual(['ended']);
  expect(test.calls()).toBe(2);
});

it('LiveCamera: keeps trying while another app holds the camera, backing off, then shows the camera help', async () => {
  const test = rig((call) => (call === 0 ? fresh() : busy()));
  test.camera.start();
  await settle();
  const restartsAt: number[] = [];
  for (let step = 0; step < 200; step += 1) {
    const before = test.calls();
    test.timer.advance(500);
    await settle();
    if (test.calls() > before) restartsAt.push(test.timer.now);
  }
  expect(restartsAt).toEqual([2_000, 6_000, 14_000, 30_000, 46_000]);
  expect(test.events).toEqual([...Array(MAX_RESTARTS).fill('stalled'), 'gave_up']);
  expect(test.states.at(-1)).toBe('camera_unavailable');
});

it('LiveCamera: starts over once a reopened stream delivers frames', async () => {
  const test = rig(fresh);
  test.camera.start();
  await settle();
  test.timer.advance(2_000);
  await settle();
  deliver(test, 1_000);
  test.timer.advance(2_000);
  await settle();
  expect(test.events).toEqual(['stalled', 'stalled']);
  expect(test.calls()).toBe(3);
});

it('LiveCamera: reports a denied camera at once and never retries it', async () => {
  const test = rig(() => new CaptureError('camera_denied', 'NotAllowedError'));
  test.camera.start();
  await settle();
  test.timer.advance(60_000);
  expect(test.states).toEqual(['camera_denied']);
  expect(test.calls()).toBe(1);
});

it('LiveCamera: stops tracks, timers and listeners on unmount, and closes a stream that opens later', async () => {
  const test = rig(fresh);
  test.camera.start();
  test.camera.stop();
  await settle();
  expect((test.streams[0] as ReturnType<typeof fakeStream>).track.stopped).toBe(true);
  expect(test.screen.srcObject).toBeNull();
  expect(test.timer.pending).toBe(0);
  expect(test.page.listeners).toBe(0);
  expect(test.screen.waiting).toBe(0);
  expect(test.states).toEqual([]);
});

const trackOf = (stream: MediaStream | undefined) => (stream as ReturnType<typeof fakeStream>).track;

it('LiveCamera: without frame reports, an unmuted track counts as working and an ended one restarts', async () => {
  const test = rig(fresh, false);
  test.camera.start();
  await settle();
  test.timer.advance(60_000);
  expect(test.calls()).toBe(1);
  trackOf(test.streams[0]).end();
  test.timer.advance(500);
  expect(test.events).toEqual(['ended']);
});

it('LiveCamera: without frame reports, a track muted for 2 s on a visible page is a stall', async () => {
  const test = rig(fresh, false);
  test.camera.start();
  await settle();
  trackOf(test.streams[0]).muted = true;
  test.page.set(false);
  test.timer.advance(10_000);
  expect(test.calls()).toBe(1);
  test.page.set(true);
  test.timer.advance(1_500);
  expect(test.calls()).toBe(1);
  test.timer.advance(1_000);
  await settle();
  expect(test.events).toEqual(['stalled']);
  expect(test.calls()).toBe(2);
  expect(test.states.at(-1)).toBe('live');
});

it('LiveCamera: a freeze during a recording ends the recording once, then reopens after it', async () => {
  const test = rig(fresh, true, { on: true, lost: 0 });
  test.camera.start();
  await settle();
  test.timer.advance(10_000);
  expect(test.recording.lost).toBe(1);
  expect(test.calls()).toBe(1);
  expect(trackOf(test.streams[0]).stopped).toBe(false);
  expect(test.events).toEqual(['recording_cut']);
  test.recording.on = false;
  test.timer.advance(500);
  await settle();
  expect(test.events).toEqual(['recording_cut', 'stalled']);
  expect(test.calls()).toBe(2);
});

it('LiveCamera: an ended track during a recording ends the recording too', async () => {
  const test = rig(fresh, true, { on: true, lost: 0 });
  test.camera.start();
  await settle();
  trackOf(test.streams[0]).end();
  test.timer.advance(500);
  expect(test.recording.lost).toBe(1);
  expect(test.calls()).toBe(1);
});

it('FrameCounter: counts presented frames and stops asking when stopped', () => {
  const screen = new FakeScreen();
  const counter = FrameCounter.for(screen);
  counter?.start();
  screen.present();
  screen.present();
  expect(counter?.count).toBe(2);
  counter?.stop();
  expect(screen.waiting).toBe(0);
});

it('FrameCounter: is absent where the browser cannot report frames', () => {
  expect(FrameCounter.for({})).toBeNull();
});
