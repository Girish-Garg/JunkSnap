"""SessionStart brief: what changed, what teammates are doing, what the team decided.

Claude Code adds this script's stdout to the session's context at startup, resume, /clear and
after compaction, so every session starts from the same shared state in git. Reads from
origin/main when it exists, so a session on an older branch still sees merged work.
"""

import json
import os
import re
import subprocess
import sys

LIMIT = 6000
STATUS_SECTIONS = ("now", "next", "blocked")


def run(cmd, cwd, timeout=5):
    try:
        r = subprocess.run(cmd, cwd=cwd, capture_output=True, text=True,
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


def main():
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass
    try:
        data = json.load(sys.stdin)
    except Exception:
        data = {}
    cwd = data.get("cwd") or os.getcwd()

    git(["fetch", "--quiet", "origin"], cwd, timeout=5)
    base = "origin/main" if git(["rev-parse", "--verify", "--quiet", "origin/main"], cwd) else "HEAD"
    branch = git(["branch", "--show-current"], cwd) or "(detached)"
    top = git(["rev-parse", "--show-toplevel"], cwd)

    out = ["# JunkSnap session brief", "",
           f"Branch: {branch} | folder: {top or cwd}",
           "Plan and tasks: docs/handover.md. Rules: AGENTS.md, docs/working.md.", ""]

    st = git(["status", "-s"], cwd)
    if st:
        lines = st.splitlines()
        out.append(f"## Uncommitted here ({len(lines)} files)")
        out += ["  " + line for line in lines[:15]]
        out.append("")

    log = git(["log", "--oneline", "-15", base], cwd)
    if log:
        out.append(f"## Latest on {base}")
        out += ["  " + line for line in log.splitlines()]
        out.append("")

    statuses = [f for f in md_files(base, "docs/status", cwd)]
    if statuses:
        out.append("## Team status (docs/status/)")
        for path in statuses:
            text = show(base, path, cwd)
            updated = re.search(r"^Updated:\s*(.+)$", text, re.M)
            name = os.path.basename(path)[:-3]
            out.append(f"- {name}{', updated ' + updated.group(1).strip() if updated else ''}")
            out += status_lines(text) or ["    (empty)"]
        out.append("")

    files = [f for f in md_files(base, "docs/decisions", cwd)
             if not os.path.basename(f).startswith(("_", "README"))]
    files = sorted(files, reverse=True)[:10]
    if files:
        out.append("## Newest decisions (accepted binds, proposed is context, superseded is history)")
        for f in files:
            status, title = decision_summary(show(base, f, cwd))
            out.append(f"  [{status}] {title}  ({os.path.basename(f)})")
        out.append("")

    contracts = git(["log", "-1", "--format=%h %ad %s", "--date=format:%d %b %H:%M",
                     base, "--", "contracts/"], cwd)
    if contracts:
        out.append(f"## Last contracts change: {contracts}")
        out.append("")

    issues = run(["gh", "issue", "list", "--state", "open", "--limit", "10"], cwd, timeout=3)
    if issues:
        out.append("## Open issues")
        out += ["  " + line for line in issues.splitlines()]
        out.append("")

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
