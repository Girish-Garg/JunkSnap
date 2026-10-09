export interface CountRequest {
  readonly key: string;
  readonly now: Date;
  readonly limit: number;
  readonly windowMs: number;
}

export interface LetterCounter {
  // Reads only: true when one more letter fits in the current window.
  fits(request: CountRequest): Promise<boolean>;
  // Records one letter, or returns false when the window is already full.
  take(request: CountRequest): Promise<boolean>;
}
