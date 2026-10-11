# /// script
# requires-python = ">=3.12"
# dependencies = []
# ///
"""Check config/ against the documented variables (docs/config.md): uv run scripts/check_config.py

1. Every server and ml variable that contracts/README.md (Environment variables) gives a numeric
   default is in config/defaults.env with that default, and every non-VITE_ key there is one.
   Rows used only by local tooling ("not a workload") and the image's own UVICORN_* are left out.
2. Every VITE_ tunable in frontend/.env.example (commented or not, endpoints aside) is in
   config/defaults.env with the same default, and every VITE_ key there is in the example.
3. Every frontend mirror equals its server value in config/defaults.env, and every key the
   loader names (ZERO_OK, FIXED) is in it.
4. Each stage file loads (no unknown, fixed or secret-looking keys, no value unlike its default),
   and values that must stay equal do.
5. No kustomization under infra/k8s sets a tunable literal: config/ is the one source.

Prints one line per problem and exits 1 if there are any.
"""

import json
import re
import sys
from decimal import Decimal, InvalidOperation
from pathlib import Path

import stage_config
from config_values import ZERO_OK
from stage_config import ENDPOINT_KEYS, FIXED, MIRRORS, VITE_PREFIX, ConfigError, parse_env

ROOT = Path(__file__).resolve().parent.parent
README = ROOT / "contracts" / "README.md"
EXAMPLE = ROOT / "frontend" / ".env.example"
DEFAULTS = ROOT / "config" / "defaults.env"
KUSTOMIZATIONS = ("infra/k8s/base/kustomization.yaml", "infra/k8s/overlays/*/kustomization.yaml")
# Documented with a number but set by the ml image, not per stage.
NOT_TUNABLES = frozenset({"UVICORN_HOST", "UVICORN_PORT"})
LOCAL_ONLY = "not a workload"
# Pairs the docs say must stay equal across two workloads (contracts/README.md).
KEEP_EQUAL = (("ML_VERIFY_TIMEOUT_S", "ML_WORKER_BUDGET_S"),)
TICKED = re.compile(r"`([^`]+)`")
DEFAULT_VALUE = re.compile(r"-?\d+(\.\d+)?|\[\s*\d+(\s*,\s*\d+)*\s*\]")
EXAMPLE_LINE = re.compile(r"#?\s*(VITE_[A-Z0-9_]+)=(.*)")
LITERAL = re.compile(r"^\s*-\s*([A-Z][A-Z0-9_]*)=", re.MULTILINE)


def env_table_rows(readme: str) -> list[list[str]]:
    """The cells of each row of the Environment variables table."""
    section = readme.split("## Environment variables", 1)[1].split("\n## ", 1)[0]
    rows = [line.strip().strip("|").split("|") for line in section.splitlines()
            if line.startswith("| `")]
    return [[cell.strip() for cell in row] for row in rows]


def row_defaults(names: list[str], value: str) -> dict[str, str]:
    """Pair a row's variables with its backticked numbers (or JSON number lists), in order."""
    found = [token for token in TICKED.findall(value) if DEFAULT_VALUE.fullmatch(token)]
    if not found:
        return {}
    if len(found) < len(names):
        raise ConfigError(f"contracts/README.md: cannot read a default for each of {names}")
    return dict(zip(names, found, strict=False))


def documented_defaults(readme: str) -> dict[str, str]:
    """Server and ml tunables with the defaults contracts/README.md gives them."""
    defaults: dict[str, str] = {}
    for names_cell, used_by, value in env_table_rows(readme):
        names = [name for name in TICKED.findall(names_cell) if name not in NOT_TUNABLES]
        if not names or names[0].startswith(VITE_PREFIX) or LOCAL_ONLY in used_by:
            continue
        defaults.update(row_defaults(names, value))
    return defaults


def example_defaults(example: str) -> dict[str, str]:
    """VITE_ tunables in frontend/.env.example, set or commented out, without the endpoints."""
    pairs = (EXAMPLE_LINE.fullmatch(line.strip()) for line in example.splitlines())
    return {m[1]: m[2].strip() for m in pairs if m and m[1] not in ENDPOINT_KEYS}


def same_value(left: str, right: str) -> bool:
    """Numbers compare by value (0.10 is 0.1), JSON lists by content, anything else as text."""
    try:
        return Decimal(left) == Decimal(right)
    except InvalidOperation:
        pass
    try:
        return bool(json.loads(left) == json.loads(right))
    except json.JSONDecodeError:
        return left == right


def compare(expected: dict[str, str], actual: dict[str, str], source: str) -> list[str]:
    """Problems between `source`'s defaults and config/defaults.env, both ways."""
    problems = [f"config/defaults.env: {key} is missing ({source} default {value})"
                for key, value in expected.items() if key not in actual]
    problems += [f"config/defaults.env: {key} is not in {source}"
                 for key in actual if key not in expected]
    problems += [f"config/defaults.env: {key}={actual[key]} but {source} says {value}"
                 for key, value in expected.items()
                 if key in actual and not same_value(actual[key], value)]
    return problems


def mirror_problems(defaults: dict[str, str]) -> list[str]:
    problems = []
    for mirror in MIRRORS:
        if mirror.server not in defaults or mirror.vite not in defaults:
            problems.append(f"config/defaults.env: mirror {mirror.server} -> {mirror.vite} "
                            "needs both keys")
        elif defaults[mirror.vite] != mirror.value(defaults[mirror.server]):
            problems.append(f"config/defaults.env: {mirror.vite}={defaults[mirror.vite]} does "
                            f"not follow {mirror.server}={defaults[mirror.server]}")
    return problems


def listed_problems(defaults: dict[str, str]) -> list[str]:
    """ZERO_OK names server and ml keys with a default above 0; FIXED names keys of defaults.env."""
    problems = [f"config_values.py: ZERO_OK names {key}, not a server or ml tunable above 0"
                for key in sorted(ZERO_OK)
                if key not in defaults or key.startswith(VITE_PREFIX)
                or not Decimal(defaults[key]) > 0]
    problems += [f"stage_config.py: FIXED names {key}, not in config/defaults.env"
                 for key in sorted(FIXED) if key not in defaults]
    return problems


def stage_problems() -> list[str]:
    """Each stage file loads, and the KEEP_EQUAL pairs agree after its overrides."""
    problems = []
    for stage in stage_config.STAGES:
        try:
            values = stage_config.load(stage).configmap
        except ConfigError as error:
            problems.append(str(error))
            continue
        problems += [f"config/{stage}.env: {a}={values[a]} but {b}={values[b]}; keep them equal"
                     for a, b in KEEP_EQUAL if not same_value(values[a], values[b])]
    return problems


def kustomize_problems(tunables: set[str]) -> list[str]:
    """Tunable literals left in a committed kustomization would be a second source."""
    problems = []
    for pattern in KUSTOMIZATIONS:
        for path in sorted(ROOT.glob(pattern)):
            keys = LITERAL.findall(path.read_text(encoding="utf-8"))
            where = path.relative_to(ROOT).as_posix()
            problems += [f"{where}: {key} is a tunable; set it in config/ instead"
                         for key in keys if key in tunables]
    return problems


def problems_and_counts() -> tuple[list[str], dict[str, int]]:
    defaults = parse_env(stage_config.read_config(DEFAULTS, "config/defaults.env"),
                         "config/defaults.env")
    server = {k: v for k, v in defaults.items() if not k.startswith(VITE_PREFIX)}
    vite = {k: v for k, v in defaults.items() if k.startswith(VITE_PREFIX)}
    documented = documented_defaults(README.read_text(encoding="utf-8"))
    example = example_defaults(EXAMPLE.read_text(encoding="utf-8"))
    problems = compare(documented, server, "contracts/README.md")
    problems += compare(example, vite, "frontend/.env.example")
    problems += mirror_problems(defaults)
    problems += listed_problems(defaults)
    problems += stage_problems()
    problems += kustomize_problems(set(defaults))
    ml = sum(1 for key in server if key.startswith("ML_") and key != "ML_VERIFY_TIMEOUT_S")
    return problems, {"server": len(server) - ml, "ml": ml, "frontend": len(vite)}


def main() -> None:
    try:
        problems, counts = problems_and_counts()
    except ConfigError as error:
        sys.exit(str(error))
    for problem in problems:
        print(problem)
    if problems:
        sys.exit(1)
    summary = ", ".join(f"{count} {area}" for area, count in counts.items())
    print(f"Config OK: {sum(counts.values())} tunables ({summary}); "
          f"stages {', '.join(stage_config.STAGES)} load.")


if __name__ == "__main__":
    main()
