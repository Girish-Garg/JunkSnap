import { z } from "zod";
import { parseEnv, type Env } from "./utils.js";

const USER_POOL_ID = /^[a-z]+(-[a-z]+)+-\d_[A-Za-z0-9]+$/;

const AuthEnv = z.object({
  COGNITO_USER_POOL_ID: z.string().regex(USER_POOL_ID, "must look like ap-south-1_AbCdEf123"),
  COGNITO_CLIENT_ID: z.string().min(1),
});

export class AuthSettings {
  readonly userPoolId: string;
  readonly clientId: string;

  private constructor(userPoolId: string, clientId: string) {
    this.userPoolId = userPoolId;
    this.clientId = clientId;
  }

  static fromEnv(env: Env): AuthSettings {
    const values = parseEnv(AuthEnv, env);
    return new AuthSettings(values.COGNITO_USER_POOL_ID, values.COGNITO_CLIENT_ID);
  }
}
