import type { Clock } from "../../ports/moderation/Clock.js";

export class SystemClock implements Clock {
  now(): Date {
    return new Date();
  }
}
