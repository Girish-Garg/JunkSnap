import { ulid } from "ulid";
import type { IdGenerator } from "../ports/IdGenerator.js";

export class UlidIdGenerator implements IdGenerator {
  next(): string {
    return ulid().toLowerCase();
  }
}
