import type { Clock } from "../ports/Clock.js";

export class SystemClock implements Clock {
  now(): Date {
    return new Date();
  }
}
