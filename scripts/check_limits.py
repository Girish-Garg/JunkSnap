# /// script
# requires-python = ">=3.12"
# dependencies = []
# ///
"""Check the size limits in docs/working.md section 4 on every file in the repo.

Files come from `git ls-files` plus untracked files that are not ignored, so a new file is
checked before it is committed. File limits skip blank lines and comment-only lines;
Python class and function limits measure the span from `class` or `def` to the last line.

Prints one line per violation as `path:line: rule (actual > limit)` and exits 1 if there
are any. Run with: uv run scripts/check_limits.py
"""

import ast
import subprocess
import sys
from pathlib import Path, PurePosixPath

ROOT = Path(__file__).resolve().parent.parent

CODE_FILE_LIMITS = {".py": 250, ".ts": 250, ".tsx": 150}
TEST_FILE_LIMIT = 400
CLASS_LIMIT = 150
FUNCTION_LIMIT = 30
ROOT_AGENTS_LIMIT = 120
OTHER_AGENTS_LIMIT = 60
DOC_FOLDER_LIMITS = {"docs/status": 30, "docs/decisions": 25}
DOC_FILES_NOT_CHECKED = {"README.md", "_template.md"}

LOCKFILES = {"uv.lock", "package-lock.json", "pnpm-lock.yaml", "yarn.lock", "poetry.lock"}
EXEMPT_FOLDERS = ("contracts/fixtures/", "docs/research/")
EXEMPT_DIR_NAMES = {"node_modules", "dist"}
GENERATED_MARKERS = (".min.", ".d.ts", ".gen.")
TEST_NAME_ENDINGS = ("_test.py", ".test.ts", ".test.tsx", ".spec.ts", ".spec.tsx")


def too_long(where: str, rule: str, actual: int, limit: int) -> str:
    """Format one violation; `where` is `path:line`."""
    return f"{where}: {rule} too long ({actual} > {limit})"


def is_exempt(path: PurePosixPath) -> bool:
    return (
        path.name in LOCKFILES
        or path.as_posix().startswith(EXEMPT_FOLDERS)
        or any(part in EXEMPT_DIR_NAMES for part in path.parts)
        or any(marker in path.name for marker in GENERATED_MARKERS)
    )


def is_test_file(path: PurePosixPath) -> bool:
    name = path.name
    return (
        "tests" in path.parts[:-1]
        or (name.startswith("test_") and name.endswith(".py"))
        or name.endswith(TEST_NAME_ENDINGS)
    )


def markdown_limit(path: PurePosixPath) -> int | None:
    if path.name == "AGENTS.md":
        return ROOT_AGENTS_LIMIT if str(path.parent) == "." else OTHER_AGENTS_LIMIT
    if path.name in DOC_FILES_NOT_CHECKED:
        return None
    return DOC_FOLDER_LIMITS.get(str(path.parent))


def file_limit(path: PurePosixPath) -> int | None:
    """The line limit for this file, or None when no limit applies."""
    if is_exempt(path):
        return None
    if path.suffix == ".md":
        return markdown_limit(path)
    if path.suffix not in CODE_FILE_LIMITS:
        return None
    if is_test_file(path):
        return TEST_FILE_LIMIT
    return CODE_FILE_LIMITS[path.suffix]


def count_python_lines(lines: list[str]) -> int:
    return sum(1 for line in lines if line.strip() and not line.strip().startswith("#"))


def count_typescript_lines(lines: list[str]) -> int:
    count = 0
    in_block_comment = False
    for line in lines:
        text = line.strip()
        if in_block_comment or text.startswith("/*"):
            in_block_comment = "*/" not in text
        elif text and not text.startswith("//"):
            count += 1
    return count


def counted_lines(path: PurePosixPath, text: str) -> int:
    lines = text.splitlines()
    if path.suffix == ".py":
        return count_python_lines(lines)
    if path.suffix in (".ts", ".tsx"):
        return count_typescript_lines(lines)
    return sum(1 for line in lines if line.strip())


def span_violation(path: PurePosixPath, node: ast.AST) -> str | None:
    if isinstance(node, ast.ClassDef):
        rule, limit = f"class {node.name}", CLASS_LIMIT
    elif isinstance(node, ast.FunctionDef | ast.AsyncFunctionDef):
        rule, limit = f"function {node.name}", FUNCTION_LIMIT
    else:
        return None
    span = (node.end_lineno or node.lineno) - node.lineno + 1
    if span <= limit:
        return None
    return too_long(f"{path}:{node.lineno}", rule, span, limit)


def python_span_violations(path: PurePosixPath, text: str) -> list[str]:
    try:
        tree = ast.parse(text, filename=str(path))
    except SyntaxError as exc:
        return [f"{path}:{exc.lineno or 1}: syntax error, cannot measure classes and functions"]
    found = (span_violation(path, node) for node in ast.walk(tree))
    return [message for message in found if message is not None]


def check_file(path: PurePosixPath, limit: int) -> list[str]:
    full_path = ROOT / path.as_posix()
    if not full_path.is_file():
        return []
    text = full_path.read_text(encoding="utf-8", errors="replace")
    found: list[str] = []
    count = counted_lines(path, text)
    if count > limit:
        found.append(too_long(f"{path}:1", "file", count, limit))
    if path.suffix == ".py":
        found += python_span_violations(path, text)
    return found


def repo_files() -> list[PurePosixPath]:
    result = subprocess.run(
        ["git", "ls-files", "-z", "--cached", "--others", "--exclude-standard"],
        cwd=ROOT, capture_output=True, text=True, encoding="utf-8", check=True,
    )
    names = {name for name in result.stdout.split("\0") if name}
    return [PurePosixPath(name) for name in sorted(names)]


def main() -> int:
    checked = 0
    violations: list[str] = []
    for path in repo_files():
        limit = file_limit(path)
        if limit is not None:
            checked += 1
            violations += check_file(path, limit)
    for message in violations:
        print(message)
    if violations:
        print(f"{len(violations)} size limit violation(s); see docs/working.md section 4.",
              file=sys.stderr)
        return 1
    print(f"Size limits OK: {checked} files checked.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
