import { z } from "zod";
import { parseEnv, type Env } from "./utils.js";

const NotesEnv = z.object({
  NOTES_TABLE: z.string().min(1),
  SITES_TABLE: z.string().min(1),
  REPORTS_TABLE: z.string().min(1),
  DEVICES_TABLE: z.string().min(1),
  USERS_TABLE: z.string().min(1),
  NOTES_PER_HOUR: z.coerce.number().int().min(1).default(10),
  NOTE_ANALYSIS_INTERVAL_MINUTES: z.coerce.number().int().min(1).max(1_440).default(10),
});

export class NotesSettings {
  readonly notesTable: string;
  readonly sitesTable: string;
  readonly reportsTable: string;
  readonly devicesTable: string;
  readonly usersTable: string;
  readonly notesPerHour: number;
  // At most one note_analysis per site in this window.
  readonly analysisIntervalMs: number;

  private constructor(values: z.output<typeof NotesEnv>) {
    this.notesTable = values.NOTES_TABLE;
    this.sitesTable = values.SITES_TABLE;
    this.reportsTable = values.REPORTS_TABLE;
    this.devicesTable = values.DEVICES_TABLE;
    this.usersTable = values.USERS_TABLE;
    this.notesPerHour = values.NOTES_PER_HOUR;
    this.analysisIntervalMs = values.NOTE_ANALYSIS_INTERVAL_MINUTES * 60_000;
  }

  static fromEnv(env: Env): NotesSettings {
    return new NotesSettings(parseEnv(NotesEnv, env));
  }
}
