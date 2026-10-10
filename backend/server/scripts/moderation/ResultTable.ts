import type { ModerationResult } from "../../src/contracts/index.gen.js";

const HEADER = [
  "| photo | faces | plates | gate | outcome | reasons | duplicate check | note |",
  "|---|---|---|---|---|---|---|---|",
];

// A Markdown table of moderation results, one row per photo.
export class ResultTable {
  readonly #rows: string[] = [];

  add(name: string, result: ModerationResult): void {
    const note = result.note_moderation;
    const cells = [
      name,
      String(result.blur?.faces ?? "-"),
      String(result.blur?.plates ?? "-"),
      `${result.image_moderation.result} ${result.image_moderation.labels.join(", ")}`.trim(),
      result.outcome,
      result.reasons.join(", ") || "-",
      result.checks.duplicate.detail,
      note === null ? "-" : `${note.result} ${note.reasons.join(", ")} (${note.provider} ${note.model})`,
    ];
    this.#rows.push(`| ${cells.join(" | ")} |`);
  }

  toString(): string {
    return [...HEADER, ...this.#rows].join("\n");
  }
}
