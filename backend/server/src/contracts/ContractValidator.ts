import { Ajv2020, type ValidateFunction } from "ajv/dist/2020.js";
import formats from "ajv-formats";
import { ValidationError } from "../domain/errors.js";

// Unlike scripts/validate_contracts.py, this also asserts formats (date-time, date, uri).
// strictTypes is off because the schemas' if/then branches rightly omit `type`.
export class ContractValidator<T> {
  readonly #name: string;
  readonly #ajv: Ajv2020;
  readonly #check: ValidateFunction<T>;

  constructor(name: string, schema: object) {
    this.#name = name;
    this.#ajv = new Ajv2020({ strictTypes: false });
    formats.default(this.#ajv);
    this.#check = this.#ajv.compile<T>(schema);
  }

  validate(value: unknown): T {
    if (this.#check(value)) {
      return value;
    }
    const details = this.#ajv.errorsText(this.#check.errors, { dataVar: this.#name });
    throw new ValidationError(details);
  }
}
