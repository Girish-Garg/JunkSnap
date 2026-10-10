import { SheetDetents, type Detent, type SheetSpace } from './SheetDetents';

export interface GesturePoint {
  readonly x: number;
  readonly y: number;
  /** Milliseconds, from the pointer event's timeStamp. */
  readonly t: number;
}

/** The handle bar always drags; the body drags only downwards, and only while its content is scrolled to the top. */
export type GestureOrigin = 'bar' | 'body';

export type GesturePhase = 'pending' | 'dragging' | 'ignored';

/** What the finger took hold of: where, whether the body was scrolled to the top, and the sheet's height then. */
export interface GestureGrip {
  readonly origin: GestureOrigin;
  readonly atTop: boolean;
  readonly from: Detent;
  readonly startHeight: number;
}

export interface SheetGestureState extends GestureGrip {
  readonly start: GesturePoint;
  readonly last: GesturePoint;
  /** Smoothed finger speed in px per ms; positive is downwards. */
  readonly velocity: number;
  readonly phase: GesturePhase;
}

/** Where the sheet is drawn under the finger: its height, and how far it is pushed below its lowest height. */
export interface SheetFrame {
  readonly height: number;
  readonly offset: number;
}

export type SheetRelease =
  | { readonly kind: 'none' }
  | { readonly kind: 'settle'; readonly detent: Detent }
  | { readonly kind: 'dismiss' };

const SLOP_PX = 6;
// Released below this share of the peek height, the sheet closes.
const DISMISS_SHARE = 0.6;
// A finger held still this long before lifting has no speed left.
const STILL_MS = 80;
const SMOOTHING = 0.7;
// Past the full height the sheet moves at this share of the finger, like a rubber band.
const RUBBER = 0.25;

/**
 * The drag-to-resize and drag-to-dismiss gesture as a pure reducer: begin, move, then release gives a detent
 * to settle on or a dismissal. SheetDrag feeds it pointer events and paints its frames.
 */
export class SheetGesture {
  static begin(grip: GestureGrip, point: GesturePoint): SheetGestureState {
    return { ...grip, start: point, last: point, velocity: 0, phase: 'pending' };
  }

  static move(state: SheetGestureState, point: GesturePoint): SheetGestureState {
    if (state.phase === 'ignored') return state;
    const elapsed = Math.max(point.t - state.last.t, 1);
    const instant = (point.y - state.last.y) / elapsed;
    const velocity = SMOOTHING * instant + (1 - SMOOTHING) * state.velocity;
    const phase = state.phase === 'dragging' ? 'dragging' : SheetGesture.#decide(state, point);
    return { ...state, last: point, velocity, phase };
  }

  /** The height the finger asks for: the start height minus how far it moved down. */
  static height(state: SheetGestureState): number {
    return state.startHeight - (state.last.y - state.start.y);
  }

  static frame(state: SheetGestureState, space: SheetSpace): SheetFrame {
    const wanted = SheetGesture.height(state);
    const floor = Math.min(SheetDetents.px('peek', space), state.startHeight);
    const ceiling = SheetDetents.px('full', space);
    const height = wanted > ceiling ? ceiling + (wanted - ceiling) * RUBBER : Math.max(wanted, floor);
    return { height, offset: Math.max(floor - wanted, 0) };
  }

  static release(state: SheetGestureState, point: GesturePoint, space: SheetSpace): SheetRelease {
    if (state.phase !== 'dragging') return { kind: 'none' };
    const last = SheetGesture.move(state, point);
    const velocity = point.t - state.last.t > STILL_MS ? 0 : last.velocity;
    const height = SheetGesture.height(last);
    const peek = SheetDetents.px('peek', space);
    if (height < peek * DISMISS_SHARE) return { kind: 'dismiss' };
    const thrown = velocity > SheetDetents.flick && (state.from === 'peek' || height <= peek);
    if (thrown) return { kind: 'dismiss' };
    return { kind: 'settle', detent: SheetDetents.settle(state.from, height, -velocity, space) };
  }

  static #decide(state: SheetGestureState, point: GesturePoint): GesturePhase {
    const dx = point.x - state.start.x;
    const dy = point.y - state.start.y;
    if (Math.max(Math.abs(dx), Math.abs(dy)) <= SLOP_PX) return 'pending';
    if (Math.abs(dx) > Math.abs(dy)) return 'ignored';
    if (state.origin === 'bar') return 'dragging';
    return dy > 0 && state.atTop ? 'dragging' : 'ignored';
  }
}
