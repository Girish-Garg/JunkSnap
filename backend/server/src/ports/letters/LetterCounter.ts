export interface CountRequest {
  readonly key: string;
  readonly now: Date;
  readonly limit: number;
  readonly windowMs: number;
}

export interface LetterCounter {
  // Reads only: true when one more letter fits in the current window.
  fits(request: CountRequest): Promise<boolean>;
  // Records one letter, or returns false when the window is full or other writers keep it changing.
  take(request: CountRequest): Promise<boolean>;
  // Gives back one letter taken in the current window; a window that has restarted since is left alone.
  release(request: CountRequest): Promise<void>;
}
