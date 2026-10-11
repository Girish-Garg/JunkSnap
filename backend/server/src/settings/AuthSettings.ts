import { z } from "zod";
import { parseEnv, type Env } from "./utils.js";

const USER_POOL_ID = /^[a-z]+(-[a-z]+)+-\d_[A-Za-z0-9]+$/;

const AuthEnv = z.object({
  COGNITO_USER_POOL_ID: z.string().regex(USER_POOL_ID, "must look like ap-south-1_AbCdEf123"),
  COGNITO_CLIENT_ID: z.string().min(1),
  // A blocked user (users.blocked) gets 403 forbidden on every signed-in route.
  USERS_TABLE: z.string().min(1),
  AWS_REGION: z.string().min(1).default("ap-south-1"),
});

export class AuthSettings {
  readonly userPoolId: string;
  readonly clientId: string;
  readonly usersTable: string;
  readonly awsRegion: string;

  private constructor(values: z.output<typeof AuthEnv>) {
    this.userPoolId = values.COGNITO_USER_POOL_ID;
    this.clientId = values.COGNITO_CLIENT_ID;
    this.usersTable = values.USERS_TABLE;
    this.awsRegion = values.AWS_REGION;
  }

  static fromEnv(env: Env): AuthSettings {
    return new AuthSettings(parseEnv(AuthEnv, env));
  }
}
