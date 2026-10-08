# Setup

## 1. Every laptop, once (about 15 minutes)

You need git, the GitHub CLI (`gh`), `uv`, Node 22, Python 3.10 or newer, and the latest Claude Code.

Windows, in PowerShell:

```powershell
winget install --id GitHub.cli
winget install --id astral-sh.uv
claude update
git config --global user.name  "<Your Name>"
git config --global user.email "<the email on your GitHub account>"
git config --global core.longpaths true
git config --global rerere.enabled true
gh auth login
setx SABOOT_WHO <gir|hem|har>
setx AWS_PROFILE saboot-<gir|hem|har>
```

Once, in an Administrator PowerShell, to allow long paths:

```powershell
New-ItemProperty -Path "HKLM:\SYSTEM\CurrentControlSet\Control\FileSystem" -Name LongPathsEnabled -Value 1 -PropertyType DWord -Force
```

Close and reopen every terminal and the Claude app after `setx`, so Claude Code sees the new variables.

macOS: put `export SABOOT_WHO=<code>` and `export AWS_PROFILE=saboot-<code>` in `~/.zshrc`. The hooks run `python`, so if only `python3` exists, link it: `ln -sf "$(command -v python3)" /usr/local/bin/python`.

Check: `python --version` prints 3.10 or newer, and `echo $env:SABOOT_WHO` (PowerShell) or `echo $SABOOT_WHO` prints your code.

## 2. Girish only: first commit and GitHub (about 30 minutes)

```powershell
cd C:\Coding\saboot
git config user.name; git config user.email     # must be you
git add -A
git status                                      # no .env files, no reports/ or research_notes/
git commit -m "chore: initial skeleton and shared agent memory files"
```

Then create the GitHub repo and push:

```powershell
gh repo create saboot --public --source . --remote origin --push
git remote set-head origin --auto
"area:frontend","area:data","area:agent","area:infra","contracts","never-cut","integration-debt" | ForEach-Object { gh label create $_ }
```

On GitHub:

- Repo settings, Collaborators: add Hemang and Harshit. Collaborators on a personal repo get write access. They must accept the email invite.
- Repo settings, General: allow squash merging only, and turn on "Automatically delete head branches".
- After CI has run once (on the first PR), add a branch ruleset for `main`: require a pull request, require the status checks `contracts`, `frontend` and `python`, require branches to be up to date, block force pushes.
- Amplify comes later, after the frontend scaffold merges: app root `frontend`, PR previews off, `VITE_API_MODE=mock`.

## 3. Hemang and Harshit: clone (about 5 minutes)

```powershell
gh repo clone <owner>/saboot C:\Coding\saboot
cd C:\Coding\saboot
claude        # accept workspace trust, then /exit
```

## 4. Everyone: prove it works (about 10 minutes)

| Test | Pass condition |
|---|---|
| `claude -w <your lane>-0-test` | The session opens with the Saboot brief: you, your lane, lane holders, teammates' status |
| In it, ask for a new file inside your lane, then one outside it | Inside is allowed; outside is denied with a "Saboot scope guard" reason |
| Ask it to push the branch to `main` | Refused by the permission rules |
| `/exit` and choose remove | The worktree and its branch are gone |
| `git status` on a fresh Windows clone | Clean (line endings are right) |

If the brief never appears and nothing is ever denied, the hooks can't start `python`. Check `python --version` in the terminal you launch Claude Code from.

## 5. Day to day

1. Pick or write a GitHub issue with the Task template, and assign yourself. The assignment is the claim.
2. `git -C C:\Coding\saboot pull`, then `claude -w <lane>-<issue>-<slug>`.
3. Plan mode first, then build, then run the issue's verify command.
4. Run the reviewer subagent on the diff, `/decide` for any cross-task choice, then `/handoff`.
5. `git fetch`, `git rebase origin/main`, `git push -u origin worktree-<name>`, `gh pr create --fill`.
6. Squash-merge your own PR when CI is green. Contract and cross-lane PRs need the other holder's approval. Exit the session and remove the worktree.

At most three sessions each: one lane writer, one read-only session in the main checkout (plan mode) for research and review, and an optional second writer for your second lane or for chores.

## 6. Two people

The lead changes `.claude/roster.json` in a `claude -w lead-roster` session. The roster for each case and the 15-minute switch are in `docs/Parallel coding agents team workflow.md`, section "Two people run the same setup with a different roster".

## 7. AWS (infra holder)

- One IAM Identity Center user (or IAM user) per person, with profiles `saboot-gir`, `saboot-hem` and `saboot-har` in `ap-south-1`. Lock the root user with MFA.
- A $30 monthly budget with alerts at $5, $15 and $25 of actual spend.
- Hemang runs the Bedrock smoke test in the first hour (see the build plan).

## Escape hatches

- Guard misbehaving: start Claude Code from a terminal with the guard off for that terminal only (PowerShell: `$env:SABOOT_GUARD="off"; claude`), and tell the lead.
- A Claude session that started in another folder and was moved into this one still points its hooks at the old folder, and every edit fails with "can't open file ... scope_guard.py". Start a fresh session in the repo instead.
