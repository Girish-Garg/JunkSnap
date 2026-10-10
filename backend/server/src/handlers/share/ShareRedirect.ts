// A plain link on the share page, for a reader without script or one who comes back to the page.
export interface ShareLink {
  readonly href: string;
  readonly label: string;
}

// Where the share page sends a person: the one inline script (hashed for the CSP) and its plain links. Both are escaped when rendered.
export interface ShareRedirect {
  readonly script: string;
  readonly links: readonly ShareLink[];
}

// A JSON string literal that cannot close the script element.
export function jsString(text: string): string {
  return JSON.stringify(text).replace(/</g, "\\u003c").replace(/>/g, "\\u003e");
}
