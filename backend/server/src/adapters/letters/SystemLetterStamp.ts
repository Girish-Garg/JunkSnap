import { ulid } from "ulid";
import type { LetterStamp } from "../../ports/letters/LetterStamp.js";

export class SystemLetterStamp implements LetterStamp {
  now(): Date {
    return new Date();
  }

  letterId(): string {
    return `ltr_${ulid().toLowerCase()}`;
  }
}
