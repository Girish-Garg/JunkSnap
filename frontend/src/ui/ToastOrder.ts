/** Hands out a higher number each time a toast shows, so the stack can put the newest lowest (CSS order). */
export class ToastOrder {
  #last = 0;

  next(): number {
    this.#last += 1;
    return this.#last;
  }
}
