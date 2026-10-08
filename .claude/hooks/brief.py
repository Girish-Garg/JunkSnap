"""SessionStart brief: who holds which lane, what teammates are doing, what the team decided.

Claude Code adds this script's stdout to the session's context at startup, resume, /clear and
after compaction, so every session starts from the same shared state in git. Reads from
origin/main when it exists, so a session on an older branch still sees teammates' merged work.
"""

import json
import os
import re
import subprocess
import sys

LIMIT = 6000
STATUS_SECTIONS = ("now", "next", "blocked")


def git(args, cwd, timeout=5):
    try:
        r = subprocess.run(["git", *args], cwd=cwd, capture_output=True, text=True,
                           encoding="utf-8", errors="replace", timeout=timeout)
        return r.stdout.strip() if r.returncode == 0 else ""
    except Exception:
        return ""


def gh(args, cwd, timeout=3):
    try:
        r = subprocess.run(["gh", *args], cwd=cwd, capture_output=True, text=True,
                           encoding="utf-8", errors="replace", timeout=timeout)
        return r.stdout.strip() if r.returncode == 0 else ""
    except Exception:
        return ""


def status_lines(text):
    keep, out = False, []
    for line in text.splitlines():
        if line.startswith("## "):
            head = line[3:].strip().lower()
            keep = head.startswith(STATUS_SECTIONS)
            if keep:
                out.append("  " + line[3:].strip())
        elif keep and line.strip():
            out.append("    " + line.strip())
    return out


def decision_summary(text):
    status = re.search(r"^status:\s*(\w+)", text, re.M)
    title = re.search(r"^# (.+)$", text, re.M)
    return (status.group(1) if status else "?"), (title.group(1).strip() if title else "(no title)")


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
    has_commits = bool(git(["rev-parse", "--verify", "--quiet", "HEAD"], cwd))
    who = os.environ.get("SABOOT_WHO", "").strip().lower()
    top = git(["rev-parse", "--show-toplevel"], cwd)
    branch = git(["branch", "--show-current"], cwd) or "(detached)"
    common = git(["rev-parse", "--path-format=absolute", "--git-common-dir"], cwd)
    main_root = os.path.dirname(common) if common else top
    in_worktree = bool(top and main_root and os.path.normcase(top) != os.path.normcase(main_root))
    wt_name = os.path.basename(top) if in_worktree else ""

    out = ["# Saboot session brief", ""]
    if not has_commits:
        out.append("Repo has no commits yet: bootstrap mode, the scope guard allows all writes.")

    roster = {}
    raw = git(["show", f"{base}:.claude/roster.json"], cwd) if has_commits else ""
    if not raw and main_root:
        try:
            with open(os.path.join(main_root, ".claude", "roster.json"), encoding="utf-8") as f:
                raw = f.read()
        except Exception:
            raw = ""
    try:
        roster = json.loads(raw) if raw else {}
    except Exception:
        roster = {}
    people = roster.get("people", {})
    lanes = roster.get("lanes", {})

    me = people.get(who, "")
    out.append(f"You: {who or 'UNSET (set SABOOT_WHO to gir, hem or har)'}{f' ({me})' if me else ''}"
               f" | branch: {branch} | {'worktree: ' + wt_name if in_worktree else 'main checkout (read-only; start writers with claude -w <lane>-<issue>-<slug>)'}")
    if in_worktree:
        lane = wt_name.split("-", 1)[0].lower()
        holder = lanes.get(lane, {}).get("holder")
        if lane not in lanes:
            out.append(f"WARNING: worktree name '{wt_name}' does not start with a lane ({', '.join(lanes)}). Writes will be blocked.")
        elif holder not in ("*", who):
            out.append(f"WARNING: lane '{lane}' is held by {people.get(holder, holder)}, not you. Writes will be blocked.")
        else:
            out.append(f"Lane: {lane} -> write only: {', '.join(lanes[lane].get('write', []))}")
    out.append("")

    if lanes:
        out.append("## Lane holders (.claude/roster.json)")
        out.append("  " + " | ".join(f"{name}: {people.get(l.get('holder'), l.get('holder'))}" for name, l in lanes.items()))
        out.append("")

    st = git(["status", "-s"], cwd)
    if st:
        lines = st.splitlines()
        out.append(f"## Uncommitted here ({len(lines)} files)")
        out += ["  " + l for l in lines[:15]]
        out.append("")

    log = git(["log", "--oneline", "-15", base], cwd) if has_commits else ""
    if log:
        out.append(f"## Latest on {base}")
        out += ["  " + l for l in log.splitlines()]
        out.append("")

    out.append("## Teammates' status (docs/status/)")
    for code, name in people.items():
        text = git(["show", f"{base}:docs/status/{code}.md"], cwd) if has_commits else ""
        if not text and main_root:
            try:
                with open(os.path.join(main_root, "docs", "status", f"{code}.md"), encoding="utf-8") as f:
                    text = f.read()
            except Exception:
                text = ""
        updated = re.search(r"^Updated:\s*(.+)$", text, re.M)
        out.append(f"- {name} ({code}){', updated ' + updated.group(1).strip() if updated else ''}")
        out += status_lines(text) or ["    (no status file)"]
    out.append("")

    names = git(["ls-tree", "--name-only", base, "docs/decisions/"], cwd) if has_commits else ""
    files = [n for n in names.splitlines() if n.endswith(".md")] if names else []
    if not files and main_root:
        d = os.path.join(main_root, "docs", "decisions")
        files = [f"docs/decisions/{n}" for n in os.listdir(d)] if os.path.isdir(d) else []
    files = sorted((f for f in files if not os.path.basename(f).startswith(("_", "README"))), reverse=True)[:10]
    if files:
        out.append("## Newest decisions (accepted binds, proposed is context, superseded is history)")
        for f in files:
            text = git(["show", f"{base}:{f}"], cwd) if has_commits else ""
            if not text:
                try:
                    with open(os.path.join(main_root, f), encoding="utf-8") as fh:
                        text = fh.read()
                except Exception:
                    text = ""
            status, title = decision_summary(text)
            out.append(f"  [{status}] {title}  ({os.path.basename(f)})")
        out.append("")

    contracts = git(["log", "-1", "--format=%h %ad %s", "--date=format:%d %b %H:%M", base, "--", "contracts/"], cwd) if has_commits else ""
    if contracts:
        out.append(f"## Last contracts change: {contracts}")
        out.append("")

    if who:
        issues = gh(["issue", "list", "--assignee", "@me", "--state", "open", "--limit", "10"], cwd)
        if issues:
            out.append("## Your open issues")
            out += ["  " + l for l in issues.splitlines()]
            out.append("")

    out.append("Protocol: one issue per session, plan first, verify with evidence, /decide for cross-task "
               "choices, /handoff before the PR. Never push to main.")

    text = "\n".join(out)
    if len(text) > LIMIT:
        text = text[: LIMIT - 40] + "\n... (brief truncated)"
    print(text)


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:  # never block a session start
        print(f"(Saboot brief failed: {exc})")
    sys.exit(0)
