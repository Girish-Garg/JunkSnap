"""PreToolUse guard for Edit, Write and NotebookEdit.

An agent may write only inside the lane named by its worktree (e.g. `fe-12-legend` -> lane `fe`),
and only if the person in SABOOT_WHO holds that lane in .claude/roster.json. The main checkout is
read-only once the repo has a commit. Paths outside the repository (auto memory, temp files)
are always allowed.

It is a lane marker, not a wall: shell commands can still write files. CI and review are the
backstop. Set SABOOT_GUARD=off in the environment that launches Claude Code to disable it.
"""

import fnmatch
import json
import os
import subprocess
import sys

WINDOWS = os.name == "nt"


def allow():
    sys.exit(0)


def deny(reason):
    print(json.dumps({"hookSpecificOutput": {
        "hookEventName": "PreToolUse",
        "permissionDecision": "deny",
        "permissionDecisionReason": f"Saboot scope guard: {reason}",
    }}))
    sys.exit(0)


def git(args, cwd):
    r = subprocess.run(["git", *args], cwd=cwd, capture_output=True, text=True,
                       encoding="utf-8", errors="replace", timeout=5)
    return r.stdout.strip() if r.returncode == 0 else ""


def norm(path):
    p = os.path.normpath(path).replace("\\", "/").rstrip("/")
    return p.lower() if WINDOWS else p


def under(path, root):
    return path == root or path.startswith(root + "/")


def load_roster(cwd, top, main_root):
    raw = git(["show", "origin/main:.claude/roster.json"], cwd)
    if raw:
        return json.loads(raw)
    for root in (top, main_root):
        try:
            with open(os.path.join(root, ".claude", "roster.json"), encoding="utf-8") as f:
                return json.load(f)
        except OSError:
            continue
    raise RuntimeError("cannot read .claude/roster.json")


def lane_of(name, lanes):
    for candidate in (name, name.removeprefix("worktree-")):
        lane = candidate.split("-", 1)[0].lower()
        if lane in lanes:
            return lane
    return None


def main():
    if os.environ.get("SABOOT_GUARD", "").strip().lower() == "off":
        allow()
    data = json.load(sys.stdin)
    tool_input = data.get("tool_input") or {}
    target = tool_input.get("file_path") or tool_input.get("notebook_path")
    if not target:
        allow()
    cwd = data.get("cwd") or os.getcwd()
    if not os.path.isabs(target):
        target = os.path.join(cwd, target)
    while not os.path.isdir(cwd) and os.path.dirname(cwd) != cwd:
        cwd = os.path.dirname(cwd)

    top_raw = git(["rev-parse", "--show-toplevel"], cwd)
    if not top_raw:
        allow()  # session is not inside a git repo
    common = git(["rev-parse", "--path-format=absolute", "--git-common-dir"], cwd)
    main_raw = os.path.dirname(common) if common else top_raw
    top, main_root, t = norm(top_raw), norm(main_raw), norm(target)

    if not (under(t, main_root) or under(t, top)):
        allow()  # outside the repository
    if not git(["rev-parse", "--verify", "--quiet", "HEAD"], cwd):
        allow()  # no commits yet: bootstrap mode

    if top == main_root:
        deny("the main checkout is read-only. Start a writer in its own worktree: "
             "claude -w <lane>-<issue>-<slug> (lanes: fe, data, agent, infra, contract, lead).")
    if not under(t, top):
        deny(f"{target} is outside this worktree ({top_raw}). Edit files only inside your own worktree.")

    roster = load_roster(cwd, top_raw, main_raw)
    lanes = roster.get("lanes", {})
    people = roster.get("people", {})
    name = os.path.basename(top_raw)
    lane = lane_of(name, lanes) or lane_of(git(["branch", "--show-current"], cwd), lanes)
    if not lane:
        deny(f"worktree '{name}' does not name a lane. Relaunch with claude -w <lane>-<issue>-<slug> "
             f"(lanes: {', '.join(lanes)}), or rename the branch to start with the lane.")

    who = os.environ.get("SABOOT_WHO", "").strip().lower()
    if not who:
        deny("SABOOT_WHO is not set. Set it to your person code (gir, hem or har) and restart Claude Code.")
    holder = lanes[lane].get("holder")
    if holder not in ("*", who):
        deny(f"lane '{lane}' is held by {people.get(holder, holder)} in .claude/roster.json, and you are "
             f"'{who}'. Ask the integration lead to change the roster, or work in a lane you hold.")

    rel = t[len(top) + 1:]
    patterns = list(lanes[lane].get("write", [])) + list(roster.get("always", [])) + [f"docs/status/{who}.md"]
    if any(fnmatch.fnmatchcase(rel, p.lower() if WINDOWS else p) for p in patterns):
        allow()
    deny(f"{rel} is outside lane '{lane}' (may write: {', '.join(lanes[lane].get('write', []))}). "
         "Open an issue for the lane that owns it, or comment on its PR.")


if __name__ == "__main__":
    try:
        main()
    except SystemExit:
        raise
    except Exception as exc:  # fail closed: a crashing guard must not let edits through
        deny(f"guard error ({exc}). Fix .claude/hooks/scope_guard.py, or set SABOOT_GUARD=off to bypass.")
