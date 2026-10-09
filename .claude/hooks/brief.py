"""SessionStart brief: what changed, what teammates are doing, what the team decided.

Claude Code adds this script's stdout to the session's context at startup, resume, /clear and
after compaction, so every session starts from the same shared state in git. Reads from
origin/main when it exists, so a session on an older branch still sees merged work.
"""

import contextlib
import json
import os
import re
import subprocess
import sys

LIMIT = 6000
STATUS_SECTIONS = ("now", "next", "blocked")
DECISIONS_TITLE = (
    "## Newest decisions (accepted binds, proposed is context, superseded is history)"
)


def run(cmd, cwd, timeout=5):
    try:
        r = subprocess.run(cmd, cwd=cwd, capture_output=True, text=True, check=False,
                           encoding="utf-8", errors="replace", timeout=timeout)
        return r.stdout.strip() if r.returncode == 0 else ""
    except Exception:
        return ""


def git(args, cwd, timeout=5):
    return run(["git", *args], cwd, timeout)


def show(base, path, cwd):
    return git(["show", f"{base}:{path}"], cwd)


def status_lines(text):
    keep, out = False, []
    for line in text.splitlines():
        if line.startswith("## "):
            keep = line[3:].strip().lower().startswith(STATUS_SECTIONS)
            if keep:
                out.append("  " + line[3:].strip())
        elif keep and line.strip():
            out.append("    " + line.strip())
    return out


def decision_summary(text):
    status = re.search(r"^status:\s*(\w+)", text, re.M)
    title = re.search(r"^# (.+)$", text, re.M)
    return (status.group(1) if status else "?"), (title.group(1).strip() if title else "(no title)")


def md_files(base, folder, cwd):
    names = git(["ls-tree", "--name-only", base, f"{folder}/"], cwd)
    return [n for n in names.splitlines() if n.endswith(".md")]


def read_cwd():
    try:
        data = json.load(sys.stdin)
    except Exception:
        data = {}
    return data.get("cwd") or os.getcwd()


def pick_base(cwd):
    git(["fetch", "--quiet", "origin"], cwd, timeout=5)
    has_main = git(["rev-parse", "--verify", "--quiet", "origin/main"], cwd)
    return "origin/main" if has_main else "HEAD"


def header_section(cwd):
    branch = git(["branch", "--show-current"], cwd) or "(detached)"
    top = git(["rev-parse", "--show-toplevel"], cwd)
    return ["# JunkSnap session brief", "",
            f"Branch: {branch} | folder: {top or cwd}",
            "Plan and tasks: docs/handover.md. Rules: AGENTS.md, docs/working.md.", ""]


def uncommitted_section(cwd):
    st = git(["status", "-s"], cwd)
    if not st:
        return []
    lines = st.splitlines()
    return [f"## Uncommitted here ({len(lines)} files)", *["  " + line for line in lines[:15]], ""]


def log_section(base, cwd):
    log = git(["log", "--oneline", "-15", base], cwd)
    if not log:
        return []
    return [f"## Latest on {base}", *["  " + line for line in log.splitlines()], ""]


def status_section(base, cwd):
    statuses = md_files(base, "docs/status", cwd)
    if not statuses:
        return []
    out = ["## Team status (docs/status/)"]
    for path in statuses:
        text = show(base, path, cwd)
        updated = re.search(r"^Updated:\s*(.+)$", text, re.M)
        name = os.path.basename(path)[:-3]
        out.append(f"- {name}{', updated ' + updated.group(1).strip() if updated else ''}")
        out += status_lines(text) or ["    (empty)"]
    out.append("")
    return out


def decisions_section(base, cwd):
    files = [f for f in md_files(base, "docs/decisions", cwd)
             if not os.path.basename(f).startswith(("_", "README"))]
    files = sorted(files, reverse=True)[:10]
    if not files:
        return []
    out = [DECISIONS_TITLE]
    for f in files:
        status, title = decision_summary(show(base, f, cwd))
        out.append(f"  [{status}] {title}  ({os.path.basename(f)})")
    out.append("")
    return out


def contracts_section(base, cwd):
    contracts = git(["log", "-1", "--format=%h %ad %s", "--date=format:%d %b %H:%M",
                     base, "--", "contracts/"], cwd)
    if not contracts:
        return []
    return [f"## Last contracts change: {contracts}", ""]


def issues_section(cwd):
    issues = run(["gh", "issue", "list", "--state", "open", "--limit", "10"], cwd, timeout=3)
    if not issues:
        return []
    return ["## Open issues", *["  " + line for line in issues.splitlines()], ""]


def main():
    with contextlib.suppress(Exception):
        sys.stdout.reconfigure(encoding="utf-8")
    cwd = read_cwd()
    base = pick_base(cwd)

    out = header_section(cwd)
    out += uncommitted_section(cwd)
    out += log_section(base, cwd)
    out += status_section(base, cwd)
    out += decisions_section(base, cwd)
    out += contracts_section(base, cwd)
    out += issues_section(cwd)
    out.append("Protocol: one task per branch and worktree, plan first, verify with evidence, "
               "/decide for cross-task choices, /handoff before the PR. Never push to main.")

    text = "\n".join(out)
    if len(text) > LIMIT:
        text = text[: LIMIT - 40] + "\n... (brief truncated)"
    print(text)


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:  # never block a session start
        print(f"(JunkSnap brief failed: {exc})")
    sys.exit(0)
