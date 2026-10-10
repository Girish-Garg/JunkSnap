/** One downward swipe on a floating card, from the first touch to the release. */
export interface SwipeState {
  readonly startY: number;
  readonly lastY: number;
  readonly lastT: number;
  /** Smoothed finger speed in px per ms; positive is downwards. */
  readonly velocity: number;
  readonly dragging: boolean;
}

// Below this a touch is a tap; past it the card follows the finger down.
const SLOP_PX = 8;
// Released this far down, or thrown down this fast, the card goes.
const DISMISS_PX = 56;
const THROW_PX_PER_MS = 0.5;
const SMOOTHING = 0.7;

/**
 * Swipe down to dismiss, as a pure reducer (SheetGesture's little sibling for the pin card): it only follows the
 * finger downwards, and a release far enough or fast enough dismisses.
 */
export class SwipeDismiss {
  static begin(y: number, t: number): SwipeState {
    return { startY: y, lastY: y, lastT: t, velocity: 0, dragging: false };
  }

  static move(state: SwipeState, y: number, t: number): SwipeState {
    const elapsed = Math.max(t - state.lastT, 1);
    const velocity = SMOOTHING * ((y - state.lastY) / elapsed) + (1 - SMOOTHING) * state.velocity;
    const dragging = state.dragging || y - state.startY > SLOP_PX;
    return { ...state, lastY: y, lastT: t, velocity, dragging };
  }

  /** How far the card is drawn below its place: never above it. */
  static offset(state: SwipeState): number {
    return state.dragging ? Math.max(0, state.lastY - state.startY) : 0;
  }

  static dismisses(state: SwipeState): boolean {
    return state.dragging && (SwipeDismiss.offset(state) > DISMISS_PX || state.velocity > THROW_PX_PER_MS);
  }
}
