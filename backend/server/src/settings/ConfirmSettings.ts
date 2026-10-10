import { z } from "zod";
import { parseEnv, type Env } from "./utils.js";

// POST /reports/{id}/confirm counts on the devices and users rows (contracts v1.16).
const ConfirmEnv = z.object({
  DEVICES_TABLE: z.string().min(1),
  USERS_TABLE: z.string().min(1),
});

export class ConfirmSettings {
  readonly devicesTable: string;
  readonly usersTable: string;

  private constructor(values: z.output<typeof ConfirmEnv>) {
    this.devicesTable = values.DEVICES_TABLE;
    this.usersTable = values.USERS_TABLE;
  }

  static fromEnv(env: Env): ConfirmSettings {
    return new ConfirmSettings(parseEnv(ConfirmEnv, env));
  }
}
