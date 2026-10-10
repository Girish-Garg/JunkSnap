export interface Point {
  readonly x: number;
  readonly y: number;
}

/** What the viewer draws: zoom, pan while zoomed, and the drag that follows a finger at 1x. */
export interface PhotoTransform {
  readonly scale: number;
  readonly pan: Point;
  readonly drag: Point;
}

export type GestureOutcome = 'next' | 'previous' | 'close' | 'none';

const SWIPE = 60;
const SWIPE_DOWN = 100;
const TAP_MOVE = 10;
const TAP_TIME = 300;
const DOUBLE_TAP_TIME = 300;
const MAX_SCALE = 4;
const DOUBLE_TAP_SCALE = 2.5;
const ORIGIN: Point = { x: 0, y: 0 };

export const REST: PhotoTransform = { scale: 1, pan: ORIGIN, drag: ORIGIN };

const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);
const clamp = (value: number) => Math.min(MAX_SCALE, Math.max(1, value));

/** Pointer maths for one photo: swipe, swipe down, pinch, pan and double tap. Mouse and touch share it. */
export class PhotoGesture {
  readonly #pointers = new Map<number, Point>();
  #view: PhotoTransform = REST;
  #start: Point = ORIGIN;
  #startTime = 0;
  #startPan: Point = ORIGIN;
  #pinch: { readonly distance: number; readonly scale: number } | null = null;
  #pinched = false;
  #lastTap = -Infinity;

  view(): PhotoTransform {
    return this.#view;
  }

  down(id: number, at: Point, time: number): void {
    this.#pointers.set(id, at);
    if (this.#pointers.size === 2) {
      this.#pinch = { distance: this.#spread(), scale: this.#view.scale };
      this.#pinched = true;
      return;
    }
    if (this.#pointers.size > 1) return;
    this.#start = at;
    this.#startTime = time;
    this.#startPan = this.#view.pan;
    this.#pinched = false;
  }

  move(id: number, at: Point): void {
    if (!this.#pointers.has(id)) return;
    this.#pointers.set(id, at);
    if (this.#pinch && this.#pointers.size === 2) {
      const scale = clamp((this.#pinch.scale * this.#spread()) / this.#pinch.distance);
      this.#view = { ...this.#view, scale, pan: scale === 1 ? ORIGIN : this.#view.pan };
      return;
    }
    if (this.#pointers.size !== 1 || this.#pinched) return;
    const moved = { x: at.x - this.#start.x, y: at.y - this.#start.y };
    this.#view = this.#zoomed()
      ? { ...this.#view, pan: { x: this.#startPan.x + moved.x, y: this.#startPan.y + moved.y } }
      : { ...this.#view, drag: moved };
  }

  up(id: number, at: Point, time: number): GestureOutcome {
    this.move(id, at);
    if (!this.#pointers.delete(id)) return 'none';
    if (this.#pointers.size > 0) {
      this.#pinch = null;
      return 'none';
    }
    this.#view = { ...this.#view, drag: ORIGIN };
    if (this.#pinched) return 'none';
    return this.#finish({ x: at.x - this.#start.x, y: at.y - this.#start.y }, time);
  }

  cancel(id: number): void {
    this.#pointers.delete(id);
    if (this.#pointers.size === 0) this.#view = { ...this.#view, drag: ORIGIN };
  }

  #finish(moved: Point, time: number): GestureOutcome {
    if (Math.hypot(moved.x, moved.y) < TAP_MOVE && time - this.#startTime < TAP_TIME) return this.#tap(time);
    return this.#zoomed() ? 'none' : PhotoGesture.#direction(moved);
  }

  static #direction(moved: Point): GestureOutcome {
    if (Math.abs(moved.x) > Math.abs(moved.y)) {
      if (moved.x <= -SWIPE) return 'next';
      return moved.x >= SWIPE ? 'previous' : 'none';
    }
    return moved.y >= SWIPE_DOWN ? 'close' : 'none';
  }

  #tap(time: number): GestureOutcome {
    if (time - this.#lastTap > DOUBLE_TAP_TIME) {
      this.#lastTap = time;
      return 'none';
    }
    this.#lastTap = -Infinity;
    this.#view = this.#zoomed() ? REST : { ...REST, scale: DOUBLE_TAP_SCALE };
    return 'none';
  }

  /** Distance between the two fingers of a pinch. */
  #spread(): number {
    const [a, b] = [...this.#pointers.values()];
    return a && b ? Math.max(1, distance(a, b)) : 1;
  }

  #zoomed(): boolean {
    return this.#view.scale > 1;
  }
}
