import type { PointerEvent } from 'react';
import { SwipeDismiss, type SwipeState } from './SwipeDismiss';

// The click that ends a swipe arrives within this time; a later click is a fresh tap.
const CLICK_AFTER_DRAG_MS = 400;

type CardPointer = PointerEvent<HTMLElement>;

/**
 * Feeds a floating card's pointer events to SwipeDismiss and paints the offset through --card-drag (SheetDrag's
 * little sibling). The handlers are bound properties, so a component can pass them straight to the element.
 */
export class CardSwipe {
  #state: SwipeState | null = null;
  #draggedAt = -Infinity;
  #onDismiss: () => void = () => undefined;

  /** What a far or fast release does; set from an effect, so it is always current. */
  bind(onDismiss: () => void): void {
    this.#onDismiss = onDismiss;
  }

  readonly onPointerDown = (event: CardPointer): void => {
    if (event.isPrimary && event.button === 0) this.#state = SwipeDismiss.begin(event.clientY, event.timeStamp);
  };

  readonly onPointerMove = (event: CardPointer): void => {
    const before = this.#state;
    if (!before) return;
    const next = SwipeDismiss.move(before, event.clientY, event.timeStamp);
    this.#state = next;
    if (next.dragging && !before.dragging) event.currentTarget.setPointerCapture?.(event.pointerId);
    if (next.dragging) CardSwipe.#paint(event.currentTarget, SwipeDismiss.offset(next));
  };

  readonly onPointerUp = (event: CardPointer): void => this.#end(event, false);

  readonly onPointerCancel = (event: CardPointer): void => this.#end(event, true);

  /** True for the click that ends a swipe, so it does not also open the site. */
  consumedClick(timeStamp: number): boolean {
    return timeStamp - this.#draggedAt < CLICK_AFTER_DRAG_MS;
  }

  #end(event: CardPointer, cancelled: boolean): void {
    const last = this.#state;
    this.#state = null;
    if (!last?.dragging) return;
    this.#draggedAt = event.timeStamp;
    if (!cancelled && SwipeDismiss.dismisses(last)) this.#onDismiss();
    else CardSwipe.#paint(event.currentTarget, 0);
  }

  static #paint(element: HTMLElement, offset: number): void {
    element.classList.toggle('is-dragging', offset > 0);
    if (offset > 0) element.style.setProperty('--card-drag', `${offset}px`);
    else element.style.removeProperty('--card-drag');
  }
}
