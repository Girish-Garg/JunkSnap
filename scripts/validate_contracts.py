# /// script
# requires-python = ">=3.10"
# dependencies = ["jsonschema>=4.18"]
# ///
"""Check every contracts/fixtures/<schema>.<site>.json against its schema.

The schema for a fixture is contracts/schemas/<schema>.schema.json.

Fails if a schema is invalid, a fixture doesn't match its schema, a fixture has no schema,
or a schema has no fixture. Run with: uv run scripts/validate_contracts.py
"""

import json
import sys
from pathlib import Path

from jsonschema import Draft202012Validator
from jsonschema.exceptions import SchemaError

ROOT = Path(__file__).resolve().parent.parent
SCHEMAS = ROOT / "contracts" / "schemas"
FIXTURES = ROOT / "contracts" / "fixtures"


def load_validators(errors: list[str]) -> dict[str, Draft202012Validator]:
    validators: dict[str, Draft202012Validator] = {}
    for path in sorted(SCHEMAS.glob("*.schema.json")):
        name = path.name.removesuffix(".schema.json")
        try:
            schema = json.loads(path.read_text(encoding="utf-8"))
            Draft202012Validator.check_schema(schema)
            validators[name] = Draft202012Validator(schema)
        except (json.JSONDecodeError, SchemaError) as exc:
            errors.append(f"{path.name}: invalid schema: {exc}")
    return validators


def check_fixture(
    path: Path, validators: dict[str, Draft202012Validator], errors: list[str]
) -> str | None:
    """Validate one fixture. Return the schema name it covers, or None if it has no schema."""
    name = path.name.split(".", 1)[0]
    validator = validators.get(name)
    if validator is None:
        errors.append(f"{path.name}: no schema named {name}.schema.json")
        return None
    try:
        instance = json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        errors.append(f"{path.name}: invalid JSON: {exc}")
        return name
    for err in validator.iter_errors(instance):
        where = "/".join(str(p) for p in err.absolute_path) or "(root)"
        errors.append(f"{path.name}: {where}: {err.message}")
    return name


def check_fixtures(
    fixtures: list[Path], validators: dict[str, Draft202012Validator], errors: list[str]
) -> set[str]:
    covered: set[str] = set()
    for path in fixtures:
        name = check_fixture(path, validators, errors)
        if name is not None:
            covered.add(name)
    return covered


def main() -> int:
    errors: list[str] = []
    validators = load_validators(errors)
    fixtures = sorted(FIXTURES.glob("*.json"))
    covered = check_fixtures(fixtures, validators, errors)

    for name in sorted(set(validators) - covered):
        errors.append(f"{name}.schema.json: no fixture in contracts/fixtures/")

    if not validators and not fixtures:
        print("No schemas or fixtures yet.")
        return 0
    if errors:
        print("\n".join(errors))
        print(f"\n{len(errors)} contract problem(s).")
        return 1
    print(f"{len(validators)} schema(s), {len(fixtures)} fixture(s): all valid.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
