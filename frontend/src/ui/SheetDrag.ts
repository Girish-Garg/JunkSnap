import type { PointerEvent } from 'react';
import type { Detent, SheetSpace } from './SheetDetents';
import { SheetGesture, type GestureOrigin, type GesturePoint, type SheetFrame, type SheetGestureState } from './SheetGesture';
import { DESKTOP_QUERY } from './useMediaQuery';

export interface SheetDragHandlers {
  readonly onSettle: (detent: Detent) => void;
  readonly onDismiss: () => void;
}

// Controls inside the body that own their own drags: the camera, sliders, text and anything marked.
const OWN_DRAG = 'video, canvas, input, textarea, select, [data-own-drag]';
// The click that ends a drag arrives within this time; a later click is a fresh tap.
const CLICK_AFTER_DRAG_MS = 400;

function pointOf(event: PointerEvent<HTMLElement>): GesturePoint {
  return { x: event.clientX, y: event.clientY, t: event.timeStamp };
}

function ownsDrag(target: EventTarget): boolean {
  return target instanceof Element && target.closest(OWN_DRAG) !== null;
}

/** Feeds pointer events to SheetGesture and paints its frames on the sheet through two CSS variables. */
export class SheetDrag {
  #handlers: SheetDragHandlers = { onSettle: () => undefined, onDismiss: () => undefined };
  #state: SheetGestureState | null = null;
  #sheet: HTMLElement | null = null;
  #space: SheetSpace = { heightPx: 0, topInsetPx: 0 };
  #draggedAt = -Infinity;

  /** What a release does: settle on a height, or close the sheet. Set from an effect, so it is always current. */
  bind(handlers: SheetDragHandlers): void {
    this.#handlers = handlers;
  }

  begin(event: PointerEvent<HTMLElement>, origin: GestureOrigin, from: Detent): void {
    const sheet = event.currentTarget.closest<HTMLElement>('.sheet');
    if (!sheet || !event.isPrimary || event.button !== 0 || SheetDrag.sidePanel()) return;
    if (origin === 'body' && ownsDrag(event.target)) return;
    const atTop = origin === 'bar' || event.currentTarget.scrollTop <= 0;
    this.#sheet = sheet;
    this.#space = SheetDrag.#measure(sheet);
    this.#state = SheetGesture.begin({ origin, atTop, from, startHeight: sheet.offsetHeight }, pointOf(event));
  }

  move(event: PointerEvent<HTMLElement>): void {
    const before = this.#state;
    const sheet = this.#sheet;
    if (!before || !sheet) return;
    const state = SheetGesture.move(before, pointOf(event));
    this.#state = state;
    if (state.phase !== 'dragging') return;
    if (before.phase !== 'dragging') {
      event.currentTarget.setPointerCapture(event.pointerId);
      sheet.classList.add('sheet--dragging');
    }
    SheetDrag.#paint(sheet, SheetGesture.frame(state, this.#space));
  }

  end(event: PointerEvent<HTMLElement>): void {
    const state = this.#state;
    const sheet = this.#sheet;
    this.#state = null;
    if (!state || !sheet || state.phase !== 'dragging') return;
    this.#draggedAt = event.timeStamp;
    sheet.classList.remove('sheet--dragging');
    const release = SheetGesture.release(state, pointOf(event), this.#space);
    // A dismissed sheet keeps its place under the finger and slides away from there.
    if (release.kind === 'dismiss') return this.#handlers.onDismiss();
    SheetDrag.#paint(sheet, null);
    if (release.kind === 'settle') this.#handlers.onSettle(release.detent);
  }

  /** The browser took the touch over (a scroll): spring back to where the sheet was. */
  cancel(): void {
    const sheet = this.#sheet;
    const dragging = this.#state?.phase === 'dragging';
    this.#state = null;
    if (!sheet || !dragging) return;
    sheet.classList.remove('sheet--dragging');
    SheetDrag.#paint(sheet, null);
  }

  /** True while a drag is under way, so the sheet can stop the touch from also scrolling its content. */
  dragging(): boolean {
    return this.#state?.phase === 'dragging';
  }

  /** True for the click that ends a drag, so it does not also cycle the height or press a row. */
  consumeDrag(timeStamp: number): boolean {
    const dragged = timeStamp - this.#draggedAt < CLICK_AFTER_DRAG_MS;
    this.#draggedAt = -Infinity;
    return dragged;
  }

  /** On desktop the sheet is a side panel: it neither drags nor changes height. */
  static sidePanel(): boolean {
    return typeof window.matchMedia === 'function' && window.matchMedia(DESKTOP_QUERY).matches;
  }

  // The status bar inset is only known to CSS, so a hidden probe reads env(safe-area-inset-top) once per drag.
  static #measure(sheet: HTMLElement): SheetSpace {
    const probe = document.createElement('div');
    probe.style.cssText = 'position: fixed; visibility: hidden; height: env(safe-area-inset-top, 0px)';
    document.body.append(probe);
    const topInsetPx = probe.offsetHeight;
    probe.remove();
    return { heightPx: sheet.parentElement?.clientHeight ?? window.innerHeight, topInsetPx };
  }

  static #paint(sheet: HTMLElement, frame: SheetFrame | null): void {
    if (!frame) {
      sheet.style.removeProperty('--sheet-drag-height');
      sheet.style.removeProperty('--sheet-drag-offset');
      return;
    }
    sheet.style.setProperty('--sheet-drag-height', `${frame.height}px`);
    sheet.style.setProperty('--sheet-drag-offset', `${frame.offset}px`);
  }
}
