"""Per-stage tunables: config/defaults.env, then config/<stage>.env (docs/config.md).

deploy.py writes the ConfigMap set (every key without VITE_) into the stage's ConfigMap;
deploy_web.py and build_android.py add the frontend set (VITE_*) to the build env. Each frontend
mirror of a server value follows it unless the stage file sets the VITE_ one itself, so one edit
changes both. Every value here is public: it lands in a ConfigMap and in the app bundles.
A stage file's values are checked against their defaults (config_values.py) before any deploy.
Pure functions plus one file reader; no AWS, no dependencies.
"""

import codecs
import re
from dataclasses import dataclass
from decimal import Decimal, InvalidOperation
from pathlib import Path

from config_values import value_problem

CONFIG_DIR = Path(__file__).resolve().parent.parent / "config"
STAGES = ("dev", "demo")
VITE_PREFIX = "VITE_"
LINE = re.compile(r"([A-Z][A-Z0-9_]*)=(.*)")
# Set by deploy_web.py and build_android.py from stack outputs and repository variables, never here.
ENDPOINT_KEYS = frozenset({
    "VITE_API_MODE", "VITE_API_URL", "VITE_COGNITO_USER_POOL_ID", "VITE_COGNITO_CLIENT_ID",
    "VITE_WEB_URL", "VITE_SHARE_URL",
})
SECRET_WORDS = frozenset({"SECRET", "SECRETS", "PASSWORD", "PASSWD", "TOKEN", "KEY", "CREDENTIALS"})
# A name ending in one of these points at a secret (OPENAI_SECRET_ID, ..._KEY_ID); it is not one.
ID_WORDS = frozenset({"ID", "IDS", "ARN"})
# Numbers whose names contain a secret word: the Secrets Manager client's timeout.
NOT_SECRETS = frozenset({"SECRET_TIMEOUT_MS"})
# In config/defaults.env because frontend/.env.example lists them, but no stage may change them.
FIXED = {
    "VITE_ZONE_RADIUS_M": "the server's no-bin zone radius is 1000 m in code (NoBinZone.ts)",
}
NOT_UTF8 = ((codecs.BOM_UTF8, "starts with a byte order mark"),
            (codecs.BOM_UTF16_LE, "is UTF-16"), (codecs.BOM_UTF16_BE, "is UTF-16"))


class ConfigError(ValueError):
    """A config file that must not deploy: bad line, key or value, or a secret-looking key."""


@dataclass(frozen=True)
class Mirror:
    """A frontend value that repeats a server value times `factor` (s to ms, MiB to bytes)."""

    server: str
    vite: str
    factor: int = 1

    def value(self, server_value: str) -> str:
        if self.factor == 1:
            return server_value
        try:
            number = Decimal(server_value) * self.factor
        except InvalidOperation as error:
            raise ConfigError(f"{self.server}={server_value!r} is not a number") from error
        if not number.is_finite():
            raise ConfigError(f"{self.server}={server_value!r} is not a number")
        if number != number.to_integral_value():
            raise ConfigError(f"{self.server}={server_value!r} makes {self.vite} a fraction")
        return str(int(number))


MIRRORS = (
    Mirror("VOTE_RADIUS_M", "VITE_VOTE_RADIUS_M"),
    Mirror("FLAG_RADIUS_M", "VITE_FLAG_RADIUS_M"),
    Mirror("CLEANUP_NEAR_SITE_M", "VITE_CLEANUP_RADIUS_M"),
    Mirror("TARGET_MAX_M", "VITE_TARGET_MAX_M"),
    Mirror("SITE_MERGE_RADIUS_M", "VITE_SITE_MERGE_RADIUS_M"),
    Mirror("MIN_VERIFIED_REPORTS", "VITE_MIN_VERIFIED_REPORTS"),
    Mirror("SCAN_MAX_SECONDS", "VITE_SCAN_MAX_DURATION_MS", 1000),
    Mirror("SCAN_MAX_MB", "VITE_SCAN_MAX_BYTES", 1_048_576),
)


@dataclass(frozen=True)
class StageConfig:
    """One stage's resolved tunables, split by where they go, and what its stage file changed."""

    stage: str
    configmap: dict[str, str]
    vite: dict[str, str]
    overrides: dict[str, str]

    def literals(self) -> list[str]:
        """KEY=value lines for a kustomize configMapGenerator."""
        return [f"{key}={value}" for key, value in self.configmap.items()]

    def summary(self) -> str:
        """One line for the deploy log: counts and the stage file's own values."""
        changed = ", ".join(f"{key}={value}" for key, value in self.overrides.items())
        return (f"config/{self.stage}.env: {len(self.configmap)} server and ml values, "
                f"{len(self.vite)} VITE_ values; overrides: {changed or 'none'}")


def read_config(path: Path, name: str) -> str:
    """A config file's text; it must be UTF-8 without a byte order mark."""
    try:
        data = path.read_bytes()
    except FileNotFoundError as error:
        raise ConfigError(f"missing {name}") from error
    for mark, problem in NOT_UTF8:
        if data.startswith(mark):
            raise ConfigError(f"{name} {problem}; save it as UTF-8 without a BOM")
    if b"\x00" in data:
        raise ConfigError(f"{name} has NUL bytes (UTF-16?); save it as UTF-8 without a BOM")
    try:
        return data.decode("utf-8")
    except UnicodeDecodeError as error:
        raise ConfigError(f"{name} is not UTF-8 (byte {error.start}); save it as UTF-8") from error


def parse_line(line: str, where: str) -> tuple[str, str] | None:
    """One KEY=value pair, or None for a blank or comment line."""
    text = line.strip()
    if not text or text.startswith("#"):
        return None
    match = LINE.fullmatch(text)
    if match is None:
        raise ConfigError(f"{where}: expected KEY=value, got {text!r}")
    key, value = match[1], match[2].strip()
    if " #" in value:
        raise ConfigError(f"{where}: put the comment on its own line")
    if len(value) > 1 and value[0] == value[-1] and value[0] in "'\"":
        raise ConfigError(f"{where}: write {key} without quotes")
    return key, value


def parse_lines(text: str, source: str) -> dict[str, tuple[str, int]]:
    """KEY -> (value, line number) for KEY=value lines; a repeated key is an error."""
    entries: dict[str, tuple[str, int]] = {}
    for number, line in enumerate(text.splitlines(), start=1):
        pair = parse_line(line, f"{source}:{number}")
        if pair is None:
            continue
        key, value = pair
        if key in entries:
            raise ConfigError(f"{source}:{number}: {key} is set twice")
        entries[key] = (value, number)
    return entries


def parse_env(text: str, source: str) -> dict[str, str]:
    """KEY=value lines and # comments; a repeated key is an error."""
    return {key: value for key, (value, _) in parse_lines(text, source).items()}


def looks_secret(key: str) -> bool:
    """SECRET, PASSWORD, TOKEN or KEY as a word of the name, unless it names an id."""
    words = key.upper().split("_")
    if key in NOT_SECRETS or words[-1] in ID_WORDS:
        return False
    return any(word in SECRET_WORDS for word in words)


def key_problem(key: str, defaults: dict[str, str] | None) -> str | None:
    """Why `key` may not be in a config file (`defaults` None: it is defaults.env), or None."""
    if looks_secret(key):
        return f"{key} looks like a secret; config holds public values only"
    if key in ENDPOINT_KEYS:
        return f"{key} is set by the deploy scripts from the stack, not by config"
    if defaults is None:
        return None
    if key not in defaults:
        return f"{key} is not a tunable in config/defaults.env (a typo?)"
    if key in FIXED:
        return f"{key} cannot change: {FIXED[key]}"
    return None


def entry_problem(key: str, value: str, defaults: dict[str, str] | None) -> str | None:
    problem = key_problem(key, defaults)
    if problem or defaults is None:
        return problem
    bad_value = value_problem(key, value, defaults[key])
    return f"{key}={value!r} {bad_value}" if bad_value else None


def check_entries(entries: dict[str, tuple[str, int]], defaults: dict[str, str] | None,
                  source: str) -> None:
    """Refuse secret-looking and endpoint keys anywhere; in a stage file also unknown and fixed
    keys, and values unlike their defaults. Every problem names its file and line."""
    problems = [f"{source}:{line}: {problem}" for key, (value, line) in entries.items()
                if (problem := entry_problem(key, value, defaults))]
    if problems:
        raise ConfigError("; ".join(problems))


def resolve(defaults: dict[str, str], overrides: dict[str, str]) -> dict[str, str]:
    """Defaults, then the stage's overrides, then each mirror the stage did not set itself."""
    values = {**defaults, **overrides}
    for mirror in MIRRORS:
        if mirror.vite in overrides or mirror.server not in values:
            continue
        values[mirror.vite] = mirror.value(values[mirror.server])
    return values


def split(values: dict[str, str]) -> tuple[dict[str, str], dict[str, str]]:
    """The ConfigMap set (no VITE_ prefix) and the frontend build set (VITE_*)."""
    vite = {key: value for key, value in values.items() if key.startswith(VITE_PREFIX)}
    configmap = {key: value for key, value in values.items() if key not in vite}
    return configmap, vite


def build(defaults_text: str, stage_text: str, stage: str) -> StageConfig:
    """Parse, check and resolve the two files' contents."""
    default_entries = parse_lines(defaults_text, "config/defaults.env")
    check_entries(default_entries, None, "config/defaults.env")
    defaults = {key: value for key, (value, _) in default_entries.items()}
    entries = parse_lines(stage_text, f"config/{stage}.env")
    check_entries(entries, defaults, f"config/{stage}.env")
    overrides = {key: value for key, (value, _) in entries.items()}
    configmap, vite = split(resolve(defaults, overrides))
    return StageConfig(stage, configmap, vite, overrides)


def load(stage: str, folder: Path | None = None) -> StageConfig:
    """Read defaults.env and <stage>.env (both must exist) from `folder`, by default config/."""
    if stage not in STAGES:
        raise ConfigError(f"unknown stage {stage!r}; expected one of {', '.join(STAGES)}")
    where = folder or CONFIG_DIR
    defaults = read_config(where / "defaults.env", "config/defaults.env")
    overrides = read_config(where / f"{stage}.env", f"config/{stage}.env")
    return build(defaults, overrides, stage)


def load_or_exit(stage: str, folder: Path | None = None) -> StageConfig:
    """load() for the deploy and build scripts: print the summary, or stop before any work."""
    try:
        config = load(stage, folder)
    except ConfigError as error:
        raise SystemExit(f"config error: {error}") from error
    print(config.summary(), flush=True)
    return config
