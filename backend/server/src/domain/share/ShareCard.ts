// A link preview (Open Graph and Twitter card) for one shared page; every field is plain text, escaped when rendered.
export interface ShareImage {
  readonly url: string;
  readonly alt: string;
  // The logo is square and small; a site photo is shown large.
  readonly large: boolean;
  readonly width?: number;
  readonly height?: number;
}

export interface ShareCard {
  // 404 for an unknown site or area; the page still opens the app.
  readonly status: 200 | 404;
  readonly title: string;
  readonly description: string;
  readonly image: ShareImage;
  // The share link itself (og:url), so crawlers never re-read the app page, which has no tags.
  readonly pageUrl: string;
  // Where a person's browser goes next.
  readonly appUrl: string;
}
