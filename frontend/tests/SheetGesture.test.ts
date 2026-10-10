import { describe, expect, it } from 'vitest';
import type { Detent } from '../src/ui/SheetDetents';
import { SheetGesture, type GestureOrigin, type SheetGestureState } from '../src/ui/SheetGesture';

// A 390 x 844 phone: the map area above the 68 px bar is 776 px; peek 156, half 388, full 696.
const CONTAINER = { heightPx: 776, topInsetPx: 0 };
const HALF = 388;

interface Drag {
  readonly origin: GestureOrigin;
  readonly atTop: boolean;
  readonly from: Detent;
  readonly height: number;
  readonly steps: number;
  readonly stepMs: number;
  readonly liftMs: number;
}

const DEFAULT_DRAG: Drag = { origin: 'bar', atTop: true, from: 'half', height: HALF, steps: 10, stepMs: 16, liftMs: 8 };

// Moves the finger from y 400 by `dy` in `steps` moves `stepMs` apart, then lifts it `liftMs` after the last move.
function drag(dy: number, options: Partial<Drag> = {}) {
  const { origin, atTop, from, height, steps, stepMs, liftMs } = { ...DEFAULT_DRAG, ...options };
  let state: SheetGestureState = SheetGesture.begin({ origin, atTop, from, startHeight: height }, { x: 100, y: 400, t: 0 });
  for (let i = 1; i <= steps; i++) state = SheetGesture.move(state, { x: 100, y: 400 + (dy * i) / steps, t: i * stepMs });
  const lift = { x: 100, y: 400 + dy, t: steps * stepMs + liftMs };
  return { state, release: SheetGesture.release(state, lift, CONTAINER) };
}

describe('SheetGesture: when a touch becomes a drag', () => {
  it('waits out the tap slop, then drags from the handle in either direction', () => {
    const begun = SheetGesture.begin({ origin: 'bar', atTop: true, from: 'half', startHeight: HALF }, { x: 0, y: 0, t: 0 });
    expect(SheetGesture.move(begun, { x: 0, y: 4, t: 10 }).phase).toBe('pending');
    expect(SheetGesture.move(begun, { x: 0, y: -20, t: 10 }).phase).toBe('dragging');
  });

  it('leaves sideways swipes to the content (photo strips, card decks)', () => {
    expect(drag(5, { steps: 1 }).state.phase).toBe('pending');
    const begun = SheetGesture.begin({ origin: 'body', atTop: true, from: 'half', startHeight: HALF }, { x: 0, y: 0, t: 0 });
    expect(SheetGesture.move(begun, { x: 30, y: 10, t: 10 }).phase).toBe('ignored');
  });

  it('drags from the body only downwards and only with the content scrolled to the top', () => {
    expect(drag(120, { origin: 'body', atTop: true }).state.phase).toBe('dragging');
    expect(drag(120, { origin: 'body', atTop: false }).state.phase).toBe('ignored');
    expect(drag(-120, { origin: 'body', atTop: true }).state.phase).toBe('ignored');
  });

  it('an ignored touch stays ignored and releases to nothing', () => {
    const { state, release } = drag(-200, { origin: 'body' });
    expect(SheetGesture.move(state, { x: 100, y: 900, t: 999 }).phase).toBe('ignored');
    expect(release).toEqual({ kind: 'none' });
  });
});

describe('SheetGesture: following the finger', () => {
  it('stops at the full height under a status bar inset', () => {
    const frame = SheetGesture.frame(drag(-300).state, { heightPx: 776, topInsetPx: 40 });
    expect(frame.height).toBeLessThan(696);
  });

  it('shrinks with the finger, then slides below the peek height instead of squashing', () => {
    expect(SheetGesture.frame(drag(100).state, CONTAINER)).toEqual({ height: 288, offset: 0 });
    expect(SheetGesture.frame(drag(300).state, CONTAINER)).toEqual({ height: 156, offset: 68 });
  });

  it('rubber-bands past the full height', () => {
    const frame = SheetGesture.frame(drag(-400).state, CONTAINER);
    expect(frame.height).toBeGreaterThan(696);
    expect(frame.height).toBeLessThan(696 + 100);
  });
});

describe('SheetGesture: release', () => {
  it('closes when dragged well below the peek height', () => {
    expect(drag(320, { stepMs: 40, liftMs: 200 }).release).toEqual({ kind: 'dismiss' });
  });

  it('springs back to where it was after a short slow drag', () => {
    expect(drag(40, { stepMs: 40, liftMs: 200 }).release).toEqual({ kind: 'settle', detent: 'half' });
  });

  it('snaps a slow drag to the nearest height', () => {
    expect(drag(200, { stepMs: 40, liftMs: 200 }).release).toEqual({ kind: 'settle', detent: 'peek' });
    expect(drag(-280, { stepMs: 40, liftMs: 200 }).release).toEqual({ kind: 'settle', detent: 'full' });
  });

});

describe('SheetGesture: throws', () => {
  it('a throw down from half drops one step to peek; a throw from peek closes', () => {
    expect(drag(90, { steps: 3, stepMs: 10 }).release).toEqual({ kind: 'settle', detent: 'peek' });
    expect(drag(60, { steps: 3, stepMs: 10, from: 'peek', height: 156 }).release).toEqual({ kind: 'dismiss' });
  });

  it('a throw that ends below the peek height closes from any height', () => {
    expect(drag(260, { steps: 4, stepMs: 10 }).release).toEqual({ kind: 'dismiss' });
  });

  it('a throw up steps one height up', () => {
    expect(drag(-90, { steps: 3, stepMs: 10 }).release).toEqual({ kind: 'settle', detent: 'full' });
  });

  it('a finger held still before lifting has no throw left', () => {
    expect(drag(90, { steps: 3, stepMs: 10, liftMs: 300 }).release).toEqual({ kind: 'settle', detent: 'half' });
  });
});
