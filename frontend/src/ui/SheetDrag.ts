import type { PointerEvent } from 'react';
import { SheetDetents, type Detent } from './SheetDetents';

interface DragStart {
  readonly sheet: HTMLElement;
  readonly y: number;
  readonly height: number;
  readonly time: number;
  readonly from: Detent;
}

const TAP_SLOP_PX = 6;

export class SheetDrag {
  readonly #onSettle: (detent: Detent) => void;
  #start: DragStart | null = null;
  #moved = false;
  #justDragged = false;

  constructor(onSettle: (detent: Detent) => void) {
    this.#onSettle = onSettle;
  }

  begin(event: PointerEvent<HTMLElement>, from: Detent): void {
    const sheet = event.currentTarget.closest<HTMLElement>('.sheet');
    if (!sheet || event.button !== 0) return;
    this.#start = { sheet, y: event.clientY, height: sheet.offsetHeight, time: event.timeStamp, from };
    this.#moved = false;
  }

  move(event: PointerEvent<HTMLElement>): void {
    const start = this.#start;
    if (!start) return;
    const dy = start.y - event.clientY;
    if (!this.#moved && Math.abs(dy) <= TAP_SLOP_PX) return;
    if (!this.#moved) event.currentTarget.setPointerCapture(event.pointerId);
    this.#moved = true;
    start.sheet.classList.add('sheet--dragging');
    start.sheet.style.setProperty('--sheet-drag-height', `${Math.max(start.height + dy, 0)}px`);
  }

  end(event: PointerEvent<HTMLElement>): void {
    const start = this.#start;
    this.#start = null;
    if (!start || !this.#moved) return;
    const dy = start.y - event.clientY;
    const velocity = dy / Math.max(event.timeStamp - start.time, 1);
    const container = start.sheet.parentElement?.clientHeight ?? window.innerHeight;
    start.sheet.classList.remove('sheet--dragging');
    start.sheet.style.removeProperty('--sheet-drag-height');
    this.#justDragged = true;
    this.#onSettle(SheetDetents.settle(start.from, start.height + dy, velocity, container));
  }

  /** True once after a drag, so the click that ends it does not also cycle. */
  consumeDrag(): boolean {
    const dragged = this.#justDragged;
    this.#justDragged = false;
    return dragged;
  }
}
