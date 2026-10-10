import { createHash } from "node:crypto";
import type { ShareCard, ShareImage } from "../../domain/share/ShareCard.js";

const ENTITIES: Readonly<Record<string, string>> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };

export interface SharePage {
  readonly html: string;
  // For the Content-Security-Policy: only this inline redirect may run.
  readonly scriptHash: string;
}

// Escapes text for an HTML attribute or text node.
export function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (char) => ENTITIES[char] ?? char);
}

// Minimal HTML for crawlers (Open Graph and Twitter tags) that sends a person on to the app with one line of script.
export class ShareHtml {
  render(card: ShareCard): SharePage {
    const script = `location.replace(${ShareHtml.#jsString(card.appUrl)});`;
    const html = [
      "<!doctype html>",
      '<html lang="en">',
      "<head>",
      '<meta charset="utf-8">',
      '<meta name="viewport" content="width=device-width, initial-scale=1">',
      `<title>${escapeHtml(card.title)}</title>`,
      ...this.#tags(card),
      `<script>${script}</script>`,
      "</head>",
      "<body>",
      `<h1>${escapeHtml(card.title)}</h1>`,
      `<p>${escapeHtml(card.description)}</p>`,
      `<p><a href="${escapeHtml(card.appUrl)}">Open in JunkSnap</a></p>`,
      "</body>",
      "</html>",
    ].join("\n");
    return { html, scriptHash: createHash("sha256").update(script).digest("base64") };
  }

  #tags(card: ShareCard): string[] {
    const meta = (key: "name" | "property", name: string, value: string) =>
      `<meta ${key}="${name}" content="${escapeHtml(value)}">`;
    return [
      meta("name", "description", card.description),
      `<link rel="canonical" href="${escapeHtml(card.pageUrl)}">`,
      meta("property", "og:type", "website"),
      meta("property", "og:site_name", "JunkSnap"),
      meta("property", "og:locale", "en_IN"),
      meta("property", "og:title", card.title),
      meta("property", "og:description", card.description),
      meta("property", "og:url", card.pageUrl),
      ...ShareHtml.#imageTags(card.image).map(([key, name, value]) => meta(key, name, value)),
      meta("name", "twitter:title", card.title),
      meta("name", "twitter:description", card.description),
    ];
  }

  static #imageTags(image: ShareImage): ["name" | "property", string, string][] {
    const size: ["property", string, string][] = image.width && image.height
      ? [["property", "og:image:width", String(image.width)], ["property", "og:image:height", String(image.height)]]
      : [];
    return [
      ["property", "og:image", image.url],
      ["property", "og:image:alt", image.alt],
      ...size,
      ["name", "twitter:card", image.large ? "summary_large_image" : "summary"],
      ["name", "twitter:image", image.url],
      ["name", "twitter:image:alt", image.alt],
    ];
  }

  // A JSON string literal that cannot close the script element.
  static #jsString(text: string): string {
    return JSON.stringify(text).replace(/</g, "\\u003c").replace(/>/g, "\\u003e");
  }
}
