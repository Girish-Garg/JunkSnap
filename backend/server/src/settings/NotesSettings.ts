import { z } from "zod";
import { parseEnv, type Env } from "./utils.js";

const NotesEnv = z.object({
  NOTES_TABLE: z.string().min(1),
  SITES_TABLE: z.string().min(1),
  REPORTS_TABLE: z.string().min(1),
  DEVICES_TABLE: z.string().min(1),
  USERS_TABLE: z.string().min(1),
  NOTES_PER_HOUR: z.coerce.number().int().min(1).default(10),
});

export class NotesSettings {
  readonly notesTable: string;
  readonly sitesTable: string;
  readonly reportsTable: string;
  readonly devicesTable: string;
  readonly usersTable: string;
  readonly notesPerHour: number;

  private constructor(values: z.output<typeof NotesEnv>) {
    this.notesTable = values.NOTES_TABLE;
    this.sitesTable = values.SITES_TABLE;
    this.reportsTable = values.REPORTS_TABLE;
    this.devicesTable = values.DEVICES_TABLE;
    this.usersTable = values.USERS_TABLE;
    this.notesPerHour = values.NOTES_PER_HOUR;
  }

  static fromEnv(env: Env): NotesSettings {
    return new NotesSettings(parseEnv(NotesEnv, env));
  }
}
