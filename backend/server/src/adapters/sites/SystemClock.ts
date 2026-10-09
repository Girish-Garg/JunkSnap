import type { Clock } from "../../ports/sites/Clock.js";

export class SystemClock implements Clock {
  now(): Date {
    return new Date();
  }
}
