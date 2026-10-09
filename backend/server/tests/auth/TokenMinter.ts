import { generateKeyPairSync, sign, type KeyObject } from "node:crypto";
import type { Jwks } from "aws-jwt-verify/jwk";

export const POOL_ID = "ap-south-1_TestPool1";
export const CLIENT_ID = "test-client-id";
export const ISSUER = `https://cognito-idp.ap-south-1.amazonaws.com/${POOL_ID}`;
export const USER_SUB = "6b1d3c9e-2f4a-4e8b-9c7d-1a2b3c4d5e6f";

const KID = "test-key-1";
const HOUR_S = 3600;

type Claims = Record<string, unknown>;

// Signs Cognito-shaped ID tokens with a local RSA key, and publishes the matching JWKS.
export class TokenMinter {
  readonly #privateKey: KeyObject;
  readonly #publicKey: KeyObject;

  constructor() {
    const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
    this.#privateKey = privateKey;
    this.#publicKey = publicKey;
  }

  jwks(): Jwks {
    const { n, e } = this.#publicKey.export({ format: "jwk" });
    if (n === undefined || e === undefined) {
      throw new Error("RSA public key export has no n or e");
    }
    return { keys: [{ kty: "RSA", n, e, kid: KID, alg: "RS256", use: "sig" }] };
  }

  idToken(overrides: Claims = {}): string {
    const now = Math.floor(Date.now() / 1000);
    const claims: Claims = {
      sub: USER_SUB,
      aud: CLIENT_ID,
      iss: ISSUER,
      token_use: "id",
      email: "resident@example.org",
      auth_time: now,
      iat: now,
      exp: now + HOUR_S,
      ...overrides,
    };
    return this.sign(claims);
  }

  sign(claims: Claims): string {
    const header = TokenMinter.#part({ alg: "RS256", kid: KID, typ: "JWT" });
    const body = `${header}.${TokenMinter.#part(claims)}`;
    return `${body}.${sign("sha256", Buffer.from(body), this.#privateKey).toString("base64url")}`;
  }

  static #part(value: object): string {
    return Buffer.from(JSON.stringify(value)).toString("base64url");
  }
}
