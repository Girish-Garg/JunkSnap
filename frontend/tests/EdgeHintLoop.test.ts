import { afterEach, expect, it, vi } from 'vitest';
import type { FrameDetections } from '../src/domain/EdgeModel';
import { EdgeHintLoop, HINT_INTERVAL_MS } from '../src/services/EdgeHintLoop';
import { ManualTimer, settle } from './cameraFakes';

const RESULT: FrameDetections = { detections: [], capturedAtMs: 0, inferenceMs: 40 };

// A loop over a fake viewfinder: frames and visibility are set by the test; detect may take time.
function rig(detectMs = 0) {
  const timer = new ManualTimer();
  vi.spyOn(performance, 'now').mockImplementation(() => timer.now);
  const state = { frames: 0, visible: true, detects: 0 };
  const detector = {
    detect: async () => {
      state.detects += 1;
      timer.now += detectMs;
      return RESULT;
    },
  };
  const video = {} as HTMLVideoElement;
  const delays: number[] = [];
  const set = timer.set.bind(timer);
  timer.set = (run, ms) => (delays.push(ms), set(run, ms));
  const loop = new EdgeHintLoop({ detector, video: () => video, onFrame: () => undefined, timer, frames: () => state.frames, visible: () => state.visible });
  return { loop, timer, state, delays };
}

async function turn(test: ReturnType<typeof rig>, ms = HINT_INTERVAL_MS): Promise<void> {
  test.timer.advance(ms);
  await settle();
}

afterEach(() => vi.restoreAllMocks());

it('EdgeHintLoop: analyses each new viewfinder frame once, so a frozen video costs nothing', async () => {
  const test = rig();
  test.state.frames = 1;
  test.loop.start();
  await turn(test, 0);
  await turn(test);
  await turn(test);
  expect(test.state.detects).toBe(1);
  test.state.frames = 2;
  await turn(test);
  expect(test.state.detects).toBe(2);
  test.loop.stop();
});

it('EdgeHintLoop: grabs nothing while the page is hidden', async () => {
  const test = rig();
  test.state.visible = false;
  test.loop.start();
  for (let frame = 1; frame <= 8; frame += 1) {
    test.state.frames = frame;
    await turn(test);
  }
  expect(test.state.detects).toBe(0);
  test.loop.stop();
});

it('EdgeHintLoop: backs off when inference is slow: never busy more than half the time', async () => {
  const test = rig(400);
  test.loop.start();
  test.state.frames = 1;
  await turn(test, 0);
  expect(test.delays.at(-1)).toBe(400);
  test.state.frames = 2;
  await turn(test, 400);
  expect(test.delays.at(-1)).toBe(400);
  test.loop.stop();
});

it('EdgeHintLoop: keeps the 4 a second pace when inference is quick', async () => {
  const test = rig(30);
  test.loop.start();
  test.state.frames = 1;
  await turn(test, 0);
  expect(test.delays.at(-1)).toBe(HINT_INTERVAL_MS - 30);
  test.loop.stop();
  expect(test.timer.pending).toBe(0);
});
