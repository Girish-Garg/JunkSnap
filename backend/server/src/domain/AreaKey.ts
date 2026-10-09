import { ValidationError } from "./errors.js";

export const AREA_KINDS = ["ward", "assembly", "loksabha", "district"] as const;

export type AreaKind = (typeof AREA_KINDS)[number];

export interface AreaRef {
  readonly kind: AreaKind;
  readonly id: string;
  readonly name: string;
}

const AREA_ID = /^[a-z0-9-]{1,64}$/;

export class AreaKey {
  readonly kind: AreaKind;
  readonly id: string;

  private constructor(kind: AreaKind, id: string) {
    this.kind = kind;
    this.id = id;
  }

  static of(area: Pick<AreaRef, "kind" | "id">): AreaKey {
    return new AreaKey(area.kind, area.id);
  }

  static parse(kind: string, id: string): AreaKey {
    const known = AREA_KINDS.find((candidate) => candidate === kind);
    if (known === undefined) {
      throw new ValidationError(`kind must be one of ${AREA_KINDS.join(", ")}`);
    }
    if (!AREA_ID.test(id)) {
      throw new ValidationError("id must be 1 to 64 characters of a-z, 0-9 and -");
    }
    return new AreaKey(known, id);
  }

  toString(): string {
    return `${this.kind}:${this.id}`;
  }
}
