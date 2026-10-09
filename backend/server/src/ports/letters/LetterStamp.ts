// Time and id for a new letter, injected so tests are repeatable.
export interface LetterStamp {
  now(): Date;
  letterId(): string;
}
