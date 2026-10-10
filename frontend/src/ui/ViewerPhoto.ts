/** taken: the phone's shutter time; reported: when the upload id was made (server side, from its ULID). */
export interface PhotoDate {
  readonly kind: 'taken' | 'reported';
  readonly at: string;
}

/** One photo the full-screen viewer can show: a blurred public copy only, never an original. */
export interface ViewerPhoto {
  readonly url: string;
  readonly alt: string;
  /** Only when the data says so; otherwise no date is shown. */
  readonly date: PhotoDate | null;
  /** Several people reported it: covered until the viewer taps to see it. */
  readonly warned?: boolean;
  /** Residents may report this photo from the viewer. */
  readonly reportable?: boolean;
}
