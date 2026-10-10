/** One photo the full-screen viewer can show: a blurred public copy only, never an original. */
export interface ViewerPhoto {
  readonly url: string;
  readonly alt: string;
  /** ISO time the photo was taken, when the data says so; otherwise no date is shown. */
  readonly takenAt: string | null;
}
