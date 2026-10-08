# Isolating and integrating parallel AI coding agents (3 people x N agents, one repo, one AWS account)

Scope note: these notes cover git isolation, branching, partitioning and interfaces, hotspot files, guardrails, AI conflict resolution, shared-AWS conflicts, and a concrete setup for Saboot (Environmental Hacks, Oct 8–11 2026, repo `C:\Coding\saboot`, Windows 11 + macOS/Linux). Research date: 2026-10-08. Where a statement is my own reasoning rather than a cited fact, it is under "Inferences". Repo state observed at start: branch `main`, **no commits yet** (only untracked `.gitignore`, `CLAUDE.md`, `README.md`, `docs/`, `reports/`, `research_notes/`).

## 1. Git worktrees for parallel agents, and how Claude Code and other tools isolate work

### Takeaway
A git worktree gives each agent its own directory and branch while sharing a single `.git` store. Claude Code builds this in (`claude --worktree <name>`, subagent `isolation: worktree`, the `EnterWorktree`/`ExitWorktree` tools, `.worktreeinclude` for `.env` files). It also enforces isolation, blocking edits and git commands that target the main checkout. Each worktree is a fresh checkout, though: dependencies (`node_modules`, `.venv`), gitignored env files and dev-server ports must be handled per worktree. On Windows, long paths and directory links need care.

### Cited Findings
**Claude Code worktree mechanics (official docs)**
- `claude --worktree <name>` (or `-w`) creates a worktree under `.claude/worktrees/<name>/` at the repo root, on a new branch `worktree-<name>`. Running it again with a different name in another terminal starts a second isolated session. Omitting the name generates one such as `bright-running-fox`. — [Claude Code: Worktrees](https://code.claude.com/docs/en/worktrees)
- **The repo needs at least one commit.** "In a repository with no commits, the command fails with `Failed to resolve base branch "HEAD": git rev-parse failed`." — [Claude Code: Common workflows](https://code.claude.com/docs/en/common-workflows)
- Docs recommend adding `.claude/worktrees/` to `.gitignore` so worktree contents don't show as untracked files in the main checkout. — [Claude Code: Worktrees](https://code.claude.com/docs/en/worktrees)
- Interactive `--worktree` runs need workspace trust: run `claude` once in the directory first, or `--worktree` errors. `claude -p --worktree` skips the trust check. — [Claude Code: Worktrees](https://code.claude.com/docs/en/worktrees)
- "A worktree is a fresh checkout, so initialize your development environment there": install dependencies per worktree. — [Claude Code: Worktrees](https://code.claude.com/docs/en/worktrees)
- `.worktreeinclude` at the project root (gitignore syntax) copies files that are **both** matched and gitignored (e.g. `.env`, `.env.local`, `config/secrets.json`) into each new worktree. It applies to `--worktree` worktrees, subagent worktrees and desktop-app parallel sessions. It is not processed if a `WorktreeCreate` hook replaces creation. — [Claude Code: Worktrees](https://code.claude.com/docs/en/worktrees)
- **Base branch:** `worktree.baseRef` defaults to `"fresh"`, which branches from the remote default branch (`origin/HEAD`, usually `main`). It fetches if the repo hasn't been fetched in 24 h (5 s cap) and falls back to local `HEAD` when there is no remote. `"head"` branches from the current local HEAD and is needed for subagents that must build on unpushed in-progress work. A branch name cannot be set; use `git worktree add` for that. — [Claude Code: Worktrees](https://code.claude.com/docs/en/worktrees)
- `claude --worktree "#1234"` (or a PR URL) creates `.claude/worktrees/pr-1234` from the PR head fetched from `origin`. This is useful for having an agent fix or review a teammate's PR. — [Claude Code: Worktrees](https://code.claude.com/docs/en/worktrees)
- **Cleanup on exit:** a clean worktree in an unnamed session is removed automatically along with its branch. A worktree with changes, untracked files or new commits prompts keep/remove. "Removing deletes the worktree directory and its branch, along with all the work in them." `-p` runs are never cleaned up; use `git worktree remove` (after `git worktree unlock` if it is locked). — [Claude Code: Worktrees](https://code.claude.com/docs/en/worktrees)
- **Enforced isolation:** while a session is in a worktree, Claude Code blocks Edit/Write/NotebookEdit targeting the main checkout. It also blocks Bash/PowerShell/Monitor commands whose cwd resolves to the main checkout, and git redirected into the main checkout (`git -C`, `--git-dir`, `GIT_DIR`, `cd` then git). It does **not** track files written by shell commands such as `cp` or redirects. For PowerShell, only the working-directory check applies. — [Claude Code: Worktrees](https://code.claude.com/docs/en/worktrees)
- **Subagent isolation:** add `isolation: worktree` to a custom subagent's frontmatter (`.claude/agents/*.md`), or ask Claude to "use worktrees for your agents". Each subagent gets a temporary worktree, removed automatically if it made no changes, and branched from the default branch unless `worktree.baseRef: "head"`. Subagents in worktrees don't load the worktree's own `CLAUDE.md`/`.claude/rules/`. — [Claude Code: Worktrees](https://code.claude.com/docs/en/worktrees)
- **EnterWorktree:** asking Claude to "work in a worktree" mid-session uses the `EnterWorktree` tool. Entering a path outside `.claude/worktrees/` requires user approval, which only `bypassPermissions` skips. `ExitWorktree` leaves it. — [Claude Code: Worktrees](https://code.claude.com/docs/en/worktrees)
- **Hooks inside worktrees:** `${CLAUDE_PROJECT_DIR}` stays pointed at the main checkout where the session started. The hook input's `cwd` field follows Claude into the worktree. — [Claude Code: Worktrees](https://code.claude.com/docs/en/worktrees)
- **Shared vs. per-worktree:** the `.git` directory, project-scope plugins, and untracked `.claude/skills|agents|commands` (read-through) are shared. "Yes, don't ask again" permission approvals are saved to the main checkout's `.claude/settings.local.json`, **but on Windows the rule stays with that worktree**. — [Claude Code: Worktrees](https://code.claude.com/docs/en/worktrees)
- **Windows specifics:** removing a worktree deletes only the link for NTFS junctions or directory symlinks inside it, not the target (fixed in v2.1.205; earlier versions could delete the target). Worktree creation is refused if `.claude`, `.claude/worktrees` or the worktree dir is a symlink. — [Claude Code: Worktrees](https://code.claude.com/docs/en/worktrees)
- Git LFS installed with `git lfs install --local` produces pointer files in Claude-created worktrees, because repo-local filter drivers are skipped for security. Run `git lfs pull` in the worktree. — [Claude Code: Worktrees](https://code.claude.com/docs/en/worktrees)
- Manual equivalent: `git worktree add ../project-feature-a -b feature-a`, `git worktree add ../project-bugfix fix-issue-456`, `git worktree list`, `git worktree remove ../project-feature-a`. — [Claude Code: Worktrees](https://code.claude.com/docs/en/worktrees)
- Other parallelism options in Claude Code: subagents split work within one session, cross-session messaging passes findings between worktree sessions, agent teams coordinate multiple sessions, and the desktop app has a "worktree" option per session. — [Claude Code: Worktrees](https://code.claude.com/docs/en/worktrees)

**Windows long paths**
- `core.longpaths` exists only in Git for Windows. The usual fix is `git config --system core.longpaths true` from an elevated shell, or set it per repo first. — [Copia help](https://help.copia.io/knowledge/what-can-i-do-when-git-runs-into-a-long-filename-error); [Electron build notes commit](https://ayakael.net/mirrors/electron/commit/57d365a9f445774edf83d3d26250cd0eea39b12e)
- The OS-side `LongPathsEnabled` setting (Group Policy "Enable Win32 long paths" or the registry) is also needed. Explorer and some tools still mishandle long paths even with it on. — [Bryce Van Dyk](https://www.brycevandyk.com/of-too-long-file-names-in-windows-and-git/); [codemia](https://codemia.io/knowledge-hub/path/filename_too_long_in_git_for_windows)
- Deep Node.js dependency trees are a common trigger for "Filename too long". — [Electron build notes commit](https://ayakael.net/mirrors/electron/commit/57d365a9f445774edf83d3d26250cd0eea39b12e)

**Other tools' isolation models (mostly third-party sources)**
- Cursor Cloud Agents (formerly "Background Agents") run in isolated cloud VMs with a cloned repo, dependencies, secrets and startup commands. Each run creates its own branch and opens a PR. One directory lists up to 8 concurrent agents, a figure that may change. Orgs enforcing Privacy Mode cannot use them. — [morphllm: Cursor background agents](https://www.morphllm.com/cursor-background-agents); [Enterprise DNA](https://enterprisedna.co/directories/agents/cursor-background-agent); [alexcloudstar comparison](https://www.alexcloudstar.com/blog/best-background-coding-agents-2026/)
- Codex cloud runs each task in its own cloud sandbox preloaded with the repo, started from chatgpt.com/codex or `@codex` on GitHub. The output is a diff or PR. — [alexcloudstar comparison](https://www.alexcloudstar.com/blog/best-background-coding-agents-2026/)
- Common pattern: fresh VM, clone, run setup commands, execute, open a **draft** PR, "so your existing quality gates stay in charge". Treat the branch "as untrusted work from another developer": re-run tests and read the changed files. — [capy.ai background agents guide](https://capy.ai/articles/background-coding-agents-guide); [alexcloudstar comparison](https://www.alexcloudstar.com/blog/best-background-coding-agents-2026/)
- Caveat: sources disagree. One article describes Cursor background agents as local with an in-editor diff, while most describe cloud VMs. — [search summary of Cursor sources](https://www.morphllm.com/comparisons/cursor-agent)

**Practitioner reports**
- Simon Willison (Oct 2025): engineers run several Claude Code or Codex CLI instances at once, "sometimes in the same repo, sometimes against multiple checkouts or git worktrees". For him, review is the bottleneck: he lands roughly one major change at a time, while research and "scout" tasks that keep no code run alongside freely. — [Simon Willison: Embracing the parallel coding agent lifestyle](https://simonwillison.net/2025/Oct/5/parallel-coding-agents/)
- incident.io discussed shipping faster with Claude Code plus git worktrees on its "Beyond the Code" podcast. A third-party guide claims incident.io engineers run 4–5 agents daily, but I could not verify that against incident.io's own written post. — [incident.io podcast listing](https://music.amazon.co.uk/podcasts/726acb5e-bf43-4a83-ac50-f45f65f8b035/episodes/feb8815c-6605-4324-9e88-5bff80b21399/the-debrief-by-incident-io-beyond-the-code-how-we're-shipping-faster-with-claude-code-and-git-worktrees); [Verdent guide (third party)](https://www.verdent.ai/guides/how-to-run-parallel-claude-code-agents)

### Inferences
- **Saboot blocker:** `claude -w` will fail until `main` has its first commit. The first action of the event should be an initial commit on/after Oct 8 (this also satisfies the "history within event dates" rule), followed by pushing to GitHub so `origin/HEAD` exists for the `"fresh"` base.
- With `baseRef: "fresh"`, a new worktree starts from **origin/main, not local main**. Agents won't see teammates' work until it is merged and pushed, and won't see your own unpushed commits. This is good for isolation, but people must push merged work promptly. Use `"head"` only for subagents that extend your own in-progress branch.
- Standard git behavior (git-scm `git-worktree` docs; not re-fetched here): the same branch cannot be checked out in two worktrees at once. Each agent therefore needs its own branch, which Claude Code's `worktree-<name>` naming provides automatically.
- Per-worktree costs: each worktree that runs the frontend needs its own `npm ci` (often hundreds of MB of `node_modules`), and each Python service needs its own `.venv`. To limit disk use and setup time, give only frontend-touching agents a frontend install. Tools with global caches (uv's cache, the npm cache) make repeat installs faster. I have no measured numbers.
- Ports: two worktrees running a Vite dev server will contend for the same port. Vite normally moves to the next free port unless `strictPort` is set (general knowledge, not re-verified). Pin explicit ports per person or worktree (e.g. Hemang 5173–5179, Girish 5180–5189, Harshit 5190–5199) so preview URLs and CORS allowlists don't collide.
- Windows path length: `C:\Coding\saboot\.claude\worktrees\<name>\frontend\node_modules\...` adds about 35 characters to every path. Enable `core.longpaths` and `LongPathsEnabled` before the event, and keep worktree names short (e.g. `hg-legend`).
- Avoid symlinking or junctioning `node_modules` or `.venv` between worktrees to save disk. Claude Code refuses symlinked worktree dirs, removal semantics for links have changed across versions, and shared deps defeat isolation when agents change dependencies.
- For a 3.5-day event, local worktrees (zero setup, free) are the default. Cloud agents (Codex cloud, Cursor Cloud Agents, Claude Code background/cloud sessions) suit well-specified, self-contained tasks that end in a PR. They need cloud environment setup (secrets, setup scripts), which costs time on day 1.

### Gaps
- No official numbers on per-worktree disk use or setup time for a React + Python stack.
- I did not fetch git-scm `git-worktree` docs directly. Branch-exclusivity and `git worktree prune/lock` semantics are from general knowledge.
- Official Cursor and Codex docs were not fetched. Their isolation details come from third-party guides and may be out of date as of Oct 2026.
- incident.io's own written blog post was not located.

## 2. Branching strategy for a 3.5-day, 3-person, many-agent team

### Takeaway
Use trunk-based development with very short-lived branches (hours, not days): one branch per agent task, merged to `main` by PR with CI. Agents should not commit directly to `main`, because `main` auto-deploys via Amplify and many agents effectively make the team "large". Merge queues and enforced branch protection depend on the GitHub plan and repo visibility, so a public org-owned repo is the cheapest way to get them.

### Cited Findings
- Short-lived feature branches "should only last a couple of days". One developer (or a pair) per branch, merged back to trunk via PR with CI verifying "in advance of commits landing in the trunk". Updating the branch from trunk is allowed at any time, and merges to trunk only happen when closing out the branch. — [trunkbaseddevelopment.com: Short-lived feature branches](https://trunkbaseddevelopment.com/short-lived-feature-branches/)
- The same source puts the cutoff for moving from direct-to-trunk commits to short-lived branches at about 15 people ("With 16 or more, the team is more productive with short-lived feature branches"). Small teams can commit straight to trunk if they can do so "without blowing up the build server". — [trunkbaseddevelopment.com](https://trunkbaseddevelopment.com/short-lived-feature-branches/)
- Merges into other people's branches and bringing others onto your branch break the model. — [trunkbaseddevelopment.com](https://trunkbaseddevelopment.com/short-lived-feature-branches/)
- GitHub merge queue: enabled via "Require merge queue" in branch protection or rulesets. Actions workflows **must** trigger on the `merge_group` event or the required check never reports and merges fail. Failing or conflicting PRs are removed from the queue and the rest are rebuilt. Build concurrency is 1–100. Wildcard branch patterns can't be used. — [GitHub Docs: Managing a merge queue](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/configuring-pull-request-merges/managing-a-merge-queue)
- Merge queue availability: public repos owned by organizations (any plan) and private repos on GitHub Enterprise Cloud. Personal-account repos appear excluded. — [GitHub changelog: merge queue GA (2023)](https://github.blog/changelog/2023-07-12-pull-request-merge-queue-is-now-generally-available/); [trunk.io overview](https://trunk.io/learn/what-is-github-merge-queue-a-quick-overview)
- Branch protection and rulesets are **not enforced** on private repos on GitHub Free. They need Team or Enterprise for org repos, and likely Pro for personal repos. They are free on public repos. Sources conflict somewhat. — [SSW: Which GitHub plan](https://www.ssw.com.au/rules/which-github-plan); [GitHub community discussion #174400](https://github.com/orgs/community/discussions/174400); [GitHub community discussion #184363](https://github.com/orgs/community/discussions/184363)
- Simon Willison: the review bottleneck limits how many substantive changes can land at once, roughly one major change at a time per reviewer. — [Simon Willison](https://simonwillison.net/2025/Oct/5/parallel-coding-agents/)
- Amplify Hosting branches have `EnableAutoBuild` (default true) and `EnablePullRequestPreview` flags. PR previews can auto-provision a temporary backend that is deleted when the PR closes. — [AWS CDK: CfnBranchProps](https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.aws_amplify.CfnBranchProps.html); [AWS CDK: BranchOptions (alpha)](https://docs.aws.amazon.com/cdk/api/v2/docs/@aws-cdk_aws-amplify-alpha.BranchOptions.html)

### Inferences
- **Recommended model:** "trunk + agent branches". Each agent works on a `worktree-<initials>-<task>` branch for one task, pushes, and opens a PR. CI must be green, and a human (any teammate, or the owner of the touched area) clicks merge. Target branch life is under 4–6 hours, well inside the "couple of days" ceiling, because a 3.5-day event leaves no room for drift.
- **Don't let agents push to `main`.** With 3 people x 3–4 agents, about 10 concurrent writers is close to the size where trunkbaseddevelopment.com says direct trunk commits stop scaling. Every push to `main` also auto-deploys the frontend.
- **Rebase/merge cadence:** sync each agent branch with `origin/main` (a) right before opening the PR, (b) whenever `contracts/` or a lockfile changes on `main`, and (c) at least every couple of hours on longer tasks. `git fetch && git rebase origin/main` works while a branch is unpushed. After pushing, use `git merge origin/main`, or rebase plus `--force-with-lease` only on your own branch.
- **Stacked PRs** (e.g. Graphite) add tooling and learning cost with little benefit when branches live for hours. Skip them. A merge queue is worth it only if the repo is public under a GitHub org. Otherwise use "require branch up to date before merge" if available, or a social rule (re-run CI after updating from main).
- **Plan constraint:** if the repo is a private personal repo on GitHub Free, protection rules won't be enforced. Options are (a) make the repo public (common for hackathons; check event rules), (b) create a free GitHub org and make the repo public there, which also enables merge queue, or (c) rely on Claude Code hooks, permission deny rules and a team norm. Verify the current plan matrix in GitHub settings during setup.
- **Event "all members commit" rule:** squash-merge produces one commit per PR authored by the PR author. Each person should open and merge their own agents' PRs, from their own GitHub account and git identity, so authorship spreads naturally. Alternatively use merge commits to keep every commit.
- **Amplify:** keep `main` → production auto-deploy, but treat `main` as "always demoable". Optionally connect a second Amplify branch (`demo`) that is fast-forwarded manually from `main` before judging, so a bad merge can't break the judged URL. Turn PR previews off unless needed: each preview build costs build minutes and may provision a backend.

### Gaps
- I could not fetch the current (2026) GitHub plan comparison page. The plan-to-feature mapping for protection and merge queue rests on 2023 changelogs and secondary sources.
- I did not fetch Graphite or Martin Fowler pages. The stacked-PR recommendation is reasoning, not a sourced comparison.
- The Amplify console steps for disabling auto-build or previews were not confirmed in the console docs. Only the CloudFormation/CDK property names were.

## 3. Partitioning work to avoid conflicts (ownership, contracts, layout)

### Takeaway
Most conflicts are avoided before any git command runs. Give each person (and their agents) an owned directory, freeze the cross-module interface in a `contracts/` directory first (OpenAPI for the HTTP API plus JSON Schema for data files and DynamoDB items, with example fixtures), and have each side build against mocks and fixtures. Shared files are few and each has one owner.

### Cited Findings
- Branches should not be shared within a team. Each branch belongs to one developer (or pair). — [trunkbaseddevelopment.com](https://trunkbaseddevelopment.com/short-lived-feature-branches/)
- Parallel agents mean "more review load, more merge sequencing, and a greater chance that two reasonable changes conflict." — [alexcloudstar comparison](https://www.alexcloudstar.com/blog/best-background-coding-agents-2026/)
- Jesse Vincent's workflow (cited by Willison): an architect agent iterates on a plan, which fresh Claude Code instances then implement. This front-loads design before parallel implementation. — [Simon Willison](https://simonwillison.net/2025/Oct/5/parallel-coding-agents/)
- Claude Code docs point to "Monorepos and large repos" guidance for configuring Claude Code per area. `CLAUDE.md` files in a file's directory and parent directories are added to context when files are @-referenced. — [Claude Code: Common workflows](https://code.claude.com/docs/en/common-workflows)
- CODEOWNERS, required reviewers and protected branches are listed among private-repo features gated to paid plans (Pro/Team). — [archived GitHub plans page](https://help.github.com/articles/github-s-products); [SSW](https://www.ssw.com.au/rules/which-github-plan)

### Inferences
- **Layout that minimizes shared files (proposed):**
  ```
  saboot/
    contracts/                 # single owner; changed only via dedicated "contract PRs"
      openapi.yaml             # Lambda Function URL API (frontend <-> agent/API Lambdas)
      schemas/*.schema.json    # S3 data artifacts, DynamoDB items, KB metadata
      fixtures/*.json          # canonical example responses/files, validated in CI
    frontend/                  # React + MapLibre; Amplify app root (owner A)
      src/api/generated/       # TS types generated from contracts (never hand-edited)
      src/mocks/               # MSW or static fixture-backed mock client
    services/
      agent/                   # Strands agent Lambda (owner B)
      api/                     # other Lambdas, if any (owner B)
      shared/                  # Pydantic models generated from / validated against schemas
    data/
      pipelines/               # offline scripts -> S3 (owner C)
    infra/                     # SAM/CDK templates, stage config (owner B or C, single owner)
    docs/decisions/            # one file per decision (no shared append log)
    .claude/  .github/  .worktreeinclude  .gitattributes
  ```
- **Contract-first sequence for day 1 (about 60–90 minutes):** write `contracts/openapi.yaml` with 3–6 endpoints (e.g. `POST /chat` or `/ask`, `GET /layers`, `GET /sites/{id}`), JSON Schemas for each S3 artifact the data scripts produce, and one fixture per response. Merge it before feature work starts. Afterwards a contract change requires a PR touching only `contracts/` plus generated types, merged first, then each owner adapts.
- **Mocks so everyone can start in hour 1:** the frontend reads fixtures through a mock client (or a static JSON server) behind a `VITE_API_MODE=mock|live` flag. The agent Lambda is unit-tested by feeding fixture inputs. The data scripts validate their outputs against the JSON Schema before uploading.
- **Shared types:** generate TS types from OpenAPI (e.g. `openapi-typescript`) and Pydantic models from JSON Schema (e.g. `datamodel-code-generator`), or hand-write Pydantic models and export JSON Schema from them. Pick one source of truth. Tool names are from general knowledge; their versions and Windows behavior were not verified here.
- **Agent task sizing:** one task = one directory, one PR, a few hours of work. Two agents never touch the same directory at the same time unless one is read-only (research or scout).
- **Ownership enforcement:** CODEOWNERS (if the plan enforces it), a Claude Code PreToolUse hook that blocks edits outside the agent's declared directory (see Q5), and the norm that "you merge PRs into your own area".

### Gaps
- I didn't fetch OpenAPI, JSON Schema, MSW or Prism docs, or code-generator docs. The tool suggestions are unverified for Oct 2026 versions and Windows.
- I found no published case study of contract-first development specifically for multi-agent hackathon teams.

## 4. Conflict hotspot files and how to handle them

### Takeaway
Lockfiles, root configs, routing tables, `CLAUDE.md`, shared logs and generated types are the predictable hotspots. Handle them by giving each one an owner, never hand-merging lockfiles (resolve the manifest, then regenerate), using `merge=union` only for truly append-only files (GitHub's web UI may ignore it), and avoiding shared append logs entirely (one file per entry).

### Cited Findings
- Since npm 5.7, running `npm install` during a conflicted state automatically resolves `package-lock.json` conflicts. A conflicted `package.json` must be resolved by hand first. `npm install --package-lock-only` rebuilds the lock without touching `node_modules`. — [npm blog: the new npm CLI, a year in review](https://blog.npmjs.org/post/173240511455/the-new-npm-cli-a-year-in-review-or-what-you); [npm v6 docs: package-locks](https://docs.npmjs.com/cli/v6/configuring-npm/package-locks); [TkDodo: Solving conflicts in package-lock.json](https://tkdodo.eu/blog/solving-conflicts-in-package-lock-json)
- `npm-merge-driver` (`npx npm-merge-driver install --global`) auto-fixes lockfile conflicts. The source material is older, so check that it still works with current npm. — [npm-merge-driver](https://npmjs.com/package/npm-merge-driver)
- TkDodo advises against deleting the lockfile and reinstalling. Fix `package.json` and let npm resolve the lock. — [TkDodo](https://tkdodo.eu/blog/solving-conflicts-in-package-lock-json)
- `merge=union` in `.gitattributes` (e.g. `Changelog merge=union`, as FFmpeg adopted in March 2025, and RuboCop for CHANGELOG.md) removes conflicts on append-only files. — [FFmpeg commit](https://ffmpeg.org/pipermail/ffmpeg-cvslog/2025-March/147728.html); [RuboCop PR #3594](https://github.com/rubocop-hq/rubocop/pull/3594)
- Limitations: GitHub's web merge did not honor `merge=union` (RuboCop PR; older SO report), so a local merge is needed. GitLab has an open request for the same. Structural edits (e.g. inserting a heading) mis-place union-merged entries, and order can come out reversed. — [RuboCop PR #3594](https://github.com/rubocop-hq/rubocop/pull/3594); [GitLab issue 17325](https://gitlab.com/gitlab-org/gitlab-foss/-/issues/17325); [quantify-scheduler issue 406](https://gitlab.com/quantify-os/quantify-scheduler/-/issues/406); [Mercurial list](https://lists.mercurial-scm.org/pipermail/mercurial/2023-January/106152.html)
- Appending at the end of subsections rather than the top narrows the conflict window but doesn't remove it. — [search summary: changelog strategy issue](https://gitlab.com/quantify-os/quantify-scheduler/-/issues/406)

### Inferences
- **Hotspot table for Saboot (proposed):**

  | File(s) | Risk | Rule |
  |---|---|---|
  | `frontend/package.json` + `package-lock.json` | every agent adding a dep | Only the frontend owner adds deps; agents ask in the PR description. On conflict, take `main`'s lock, re-apply your `package.json` change, run `npm install --package-lock-only`, commit both. |
  | `services/*/pyproject.toml` + `uv.lock` (or `requirements.txt`) | same | One lock per service dir, not a root lock. On conflict, resolve `pyproject.toml`, then rerun `uv lock` (or regenerate requirements) and commit. Never hand-merge. |
  | `contracts/**` | breaks everyone | Single owner. Contract-only PRs, merged first. CI validates fixtures against schemas. |
  | Generated types (`frontend/src/api/generated`, `services/shared/models.py`) | noisy diffs | Regenerate from contracts in CI or with a script. On conflict, take either side and regenerate. Mark `linguist-generated=true` in `.gitattributes`. |
  | `infra/` templates, `samconfig.toml`, `amplify.yml` | deploy breakage | Single infra owner. Agents may propose changes only in PRs labelled `infra`. |
  | Router/route tables (`frontend/src/routes.tsx`), map layer registry | everyone adds a route or layer | Use a registry pattern (one file per layer/page auto-discovered via `import.meta.glob`) so additions are new files, not edits to one list. |
  | Root `CLAUDE.md` | every agent "learns" things and edits it | Owner-only. Area rules go in `frontend/CLAUDE.md`, `services/CLAUDE.md`, `data/CLAUDE.md`, each edited only by that area's owner. Tell agents not to edit `CLAUDE.md` (also enforce via hook or deny rule). |
  | `docs/` progress logs, `research_notes/`, `reports/` | parallel appends | One file per entry (`docs/log/2026-10-09T1430-hg-legend.md`) instead of one shared log. If a single log is unavoidable, `docs/LOG.md merge=union` plus local merges. |
  | `.gitignore`, `.gitattributes`, `.github/workflows/*`, `.claude/settings.json` | config drift | Set up in hour 1 by one person, then change rarely and only via a small PR. |
  | Line endings (Windows plus macOS) | whole-file diffs | `.gitattributes`: `* text=auto eol=lf` (with `*.ps1 text eol=crlf` if any PowerShell scripts). Commit this first. |

- `git config rerere.enabled true` lets git replay a recorded conflict resolution when the same conflict recurs after rebases. This is standard git, not re-verified here.

### Gaps
- I didn't fetch official `uv` docs on lockfile conflict handling. The "resolve `pyproject.toml`, then `uv lock`" rule is general practice and unverified for Oct 2026.
- Whether GitHub's web UI honors `merge=union` as of 2026 was not verified; the reports are older.
- Current maintenance status of `npm-merge-driver` was not confirmed.

## 5. Automated guardrails that catch breakage before it lands

### Takeaway
Layer cheap, fast checks. Claude Code hooks stop agents in the moment: PreToolUse denies edits outside the assigned directory or to hotspot files, and a Stop hook refuses to finish until tests pass. Pre-commit hooks run lint and format. GitHub Actions CI runs on every PR and is required before merge: lint, typecheck, tests, build, contract validation. A smoke test hits the deployed `demo` stage after each `main` deploy.

### Cited Findings
- PreToolUse hooks receive JSON on stdin with `tool_name`, `tool_input` (e.g. `tool_input.file_path` for Edit/Write, `tool_input.command` for Bash), `cwd`, `session_id` and `permission_mode`. — [Claude Code: Hooks](https://code.claude.com/docs/en/hooks)
- Blocking: exit code 2 (stderr becomes the reason shown to Claude), or exit 0 with `{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"deny","permissionDecisionReason":"..."}}`. Other nonzero exits and timeouts are **non-blocking**. — [Claude Code: Hooks](https://code.claude.com/docs/en/hooks)
- Matcher `"Edit|Write"` matches those tools exactly. Other characters make the matcher an unanchored regex. — [Claude Code: Hooks](https://code.claude.com/docs/en/hooks)
- Stop and SubagentStop: exit 2, or `{"decision":"block","reason":"..."}`, prevents Claude from stopping. The docs use a test-suite gate as the example. Guard against infinite loops (a `stop_hook_active`-style check; the field was not confirmed in the excerpt I read). — [Claude Code: Hooks](https://code.claude.com/docs/en/hooks)
- Config locations: `~/.claude/settings.json` (user), `.claude/settings.json` (project, commit it), `.claude/settings.local.json` (project, gitignored). `${CLAUDE_PROJECT_DIR}` resolves to where the session started, even inside a worktree. The `args` exec form avoids quoting issues. — [Claude Code: Hooks](https://code.claude.com/docs/en/hooks)
- Windows: command hooks run in Git Bash if installed, otherwise PowerShell. `"shell": "powershell"` forces PowerShell. The PowerShell pattern is `"command": "powershell.exe", "args": ["-NoProfile","-ExecutionPolicy","Bypass","-File","${CLAUDE_PROJECT_DIR}/.claude/hooks/x.ps1"]`. `.cmd`/`.bat` shims (e.g. `node_modules/.bin`) can't be spawned in exec form, so invoke `node` directly. — [Claude Code: Hooks](https://code.claude.com/docs/en/hooks)
- "The `if` filter is best-effort. Use the permission system, not hooks, for hard allow or deny rules." — [Claude Code: Hooks](https://code.claude.com/docs/en/hooks)
- Inside a worktree, a hook's `cwd` input is the worktree root, while `${CLAUDE_PROJECT_DIR}` stays at the main checkout. — [Claude Code: Worktrees](https://code.claude.com/docs/en/worktrees)
- GitHub merge queue requires CI workflows to trigger on `merge_group` as well as `pull_request`. — [GitHub Docs: Managing a merge queue](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/configuring-pull-request-merges/managing-a-merge-queue)
- Cloud-agent guides recommend draft PRs so "existing quality gates stay in charge", plus re-running tests locally on agent branches. — [capy.ai](https://capy.ai/articles/background-coding-agents-guide); [alexcloudstar](https://www.alexcloudstar.com/blog/best-background-coding-agents-2026/)

### Inferences
- **Directory-ownership hook (cross-platform):** write the hook in Node or Python rather than bash, so it runs identically on Windows and macOS. Sketch:
  - Each worktree gets a gitignored `.agent-scope` file (copied via `.worktreeinclude`, or written by the person when starting the agent) containing allowed path globs, e.g. `frontend/**`.
  - PreToolUse matcher `Edit|Write|NotebookEdit`. The hook reads `cwd` and `tool_input.file_path`, makes the path relative to `cwd`, and denies with a clear reason if it falls outside the allowed globs or matches a protected list (`contracts/**`, `infra/**`, `CLAUDE.md`, `**/package-lock.json`, `**/uv.lock`, `.github/**`).
  - Register it as `{"type":"command","command":"node","args":["${CLAUDE_PROJECT_DIR}/.claude/hooks/scope-guard.mjs"]}`. Exec form calls `node` directly, avoiding the `.cmd` shim problem.
  - Caveat: Bash or PowerShell commands (`echo > file`, `cp`) can still write anywhere. Add a `permissions.deny` list for the protected paths as the "hard" layer, and rely on CI and review for the rest.
- **Stop hook:** run only the fast tests for the area the agent touched (`npm run -s typecheck && npm test -- --run` in `frontend/`; `pytest -q` in a service dir). Return `decision: block` with failing output, capped at about 2 minutes. Skip when nothing changed.
- **Pre-commit (fast, local):** formatters and linters only (Prettier/ESLint for TS; Ruff for Python), plus a check rejecting files over a size threshold (data outputs belong in S3, not git). Keep it under about 10 s so agents don't learn to bypass it. Never let agents use `--no-verify`; add it to a Bash deny pattern.
- **CI on PR (GitHub Actions, path-filtered jobs):**
  - `frontend`: `npm ci`, `npm run lint`, `npx tsc --noEmit`, `npm test -- --run`, `npm run build`.
  - `python`: `uv sync --frozen` (fails if the lock is stale), `ruff check`, `pytest -q` for each service and pipeline.
  - `contracts`: lint the OpenAPI file, validate every fixture against its schema, and regenerate types and fail if the git diff is non-empty (catches stale generated types).
  - Optional `infra`: `sam validate` / `cdk synth` (no deploy).
  - Triggers: `pull_request` and, if a merge queue is used, `merge_group`. Set `concurrency` per-PR with cancel-in-progress so rapid agent pushes don't pile up runs.
- **Post-deploy smoke test:** after Amplify deploys `main` (or on push to `main`), a workflow curls the frontend URL and calls the `demo` Lambda Function URL with a fixture request, asserting a 200 response and schema-valid output. If it fails, revert the last merge immediately; don't fix forward under time pressure.

### Gaps
- I only read the first ~40% of the hooks reference. Exact Stop-hook loop-guard fields and the `permissions.deny` syntax for path patterns were not confirmed in this session (see the [settings/permissions docs](https://code.claude.com/docs/en/hooks) for the full reference).
- Amplify's webhook or notification mechanism for triggering a post-deploy smoke test was not researched.

## 6. How AI agents should resolve merge conflicts, and when that is safe

### Takeaway
I found little authoritative guidance specific to AI conflict resolution. Sourced practice supports a conservative rule: agents may resolve mechanical conflicts (lockfiles by regeneration, generated files, imports, formatting, adjacent additions) and must re-run the full checks afterwards. Semantic conflicts in contracts, shared logic, infra or data schemas go to the owning human, and the resulting branch is treated as untrusted until tests and a review pass.

### Cited Findings
- Lockfile conflicts should be resolved by tooling (`npm install` / `--package-lock-only`) after hand-fixing `package.json`, not by editing the lock. — [npm blog](https://blog.npmjs.org/post/173240511455/the-new-npm-cli-a-year-in-review-or-what-you); [TkDodo](https://tkdodo.eu/blog/solving-conflicts-in-package-lock-json)
- Agent output should be treated "as untrusted work from another developer": re-run tests and read changed files. — [alexcloudstar comparison](https://www.alexcloudstar.com/blog/best-background-coding-agents-2026/)
- Review is the binding constraint on parallel agents. — [Simon Willison](https://simonwillison.net/2025/Oct/5/parallel-coding-agents/)
- `merge=union` resolutions can silently mis-place content when the structure changed. Automated "conflict-free" merges are not necessarily correct. — [quantify-scheduler issue 406](https://gitlab.com/quantify-os/quantify-scheduler/-/issues/406)
- Claude Code can check out a PR into its own worktree (`claude --worktree "#123"`), so an agent can resolve conflicts for a PR without touching anyone's working directory. — [Claude Code: Worktrees](https://code.claude.com/docs/en/worktrees)

### Inferences
- **Safe for an agent to resolve alone:** lockfiles (regenerate), generated code (regenerate), import ordering and formatting, two independent additions to a list or registry, docs and notes, and conflicts inside the agent's own owned directory, where the other side is also its owner's work.
- **Unsafe, needs a human (the area owner):** `contracts/**`, anything changing a function signature or data shape used across modules, `infra/**` and deployment config, DynamoDB key schema or S3 path layout, auth/CORS/IAM, and any conflict where "both sides" changed the same logic, i.e. semantic conflicts that still compile.
- **Procedure:** the agent rebases onto `origin/main` in its worktree. For each conflicted file it states which side it kept and why (in the PR description). It runs the full local check suite, pushes, and lets CI re-run. A human skims the conflict-resolution diff (`git range-diff` or the PR's "changes since last review") before merging.
- **Prevention beats resolution:** small PRs, frequent syncs, ownership, and contract-first design leave few conflicts to resolve at all.
- Never let an agent use `git push --force` to `main`, `git reset --hard origin/...` in someone else's worktree, or `-X ours/theirs` wholesale on code files. Deny those Bash patterns.

### Gaps
- I found no authoritative (vendor or peer-reviewed) study of AI agents' accuracy at semantic merge-conflict resolution as of Oct 2026.
- No official Anthropic guidance on conflict resolution workflows was located in this session.

## 7. Avoiding shared-cloud conflicts in one AWS account (ap-south-1)

### Takeaway
Namespace everything by stage. Each developer gets a personal stage (their own CloudFormation stacks, Lambda Function URLs, DynamoDB tables, S3 prefixes) deployed from their own credentials. One shared `demo` stage is deployed only by CI or one named person. Bedrock Knowledge Base ingestion is serialized per data source, so one person owns ingestion into the shared KB.

### Cited Findings
- Amplify Gen 2 per-developer sandboxes: `npx ampx sandbox` deploys the `amplify/` backend and hot-swaps changes. Stacks are named `amplify-<app-name>-<$(whoami)>-sandbox`. Guidance is one sandbox per app per developer to avoid conflicts. Multiple developers can share one account, and the console lists all sandboxes. `npx ampx sandbox delete` removes it, while Ctrl+C stops watching but keeps resources. — [Amplify docs: Sandbox environments setup](https://docs.amplify.aws/react/deploy-and-host/sandbox-environments/setup/)
- Amplify Hosting PR previews can auto-provision a temporary backend per PR, deleted when the PR closes. `EnablePullRequestPreview` and `EnableAutoBuild` are branch-level properties. — [AWS CDK: BranchOptions](https://docs.aws.amazon.com/cdk/api/v2/docs/@aws-cdk_aws-amplify-alpha.BranchOptions.html); [AWS CDK: CfnBranchProps](https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.aws_amplify.CfnBranchProps.html)
- Bedrock KB ingestion concurrency, from secondary sources summarizing an AWS blog: 5 concurrent ingestion jobs per account, 1 per KB, 1 per data source. KB management API rate is about 0.1 req/s. — [letsdatascience summary of AWS blog](https://letsdatascience.com/news/amazon-bedrock-adds-automatic-knowledge-base-sync-solution-1f8bab66); [HKU mirror of AWS blog](https://aihub.hkuspace.hku.hk/?p=6310)
- `StartIngestionJob` accepts a `clientToken`. A repeated token is ignored without error (idempotent retries). `ListIngestionJobs`, `GetIngestionJob` and `StopIngestionJob` exist for checking and stopping running jobs. — [Bedrock API: StartIngestionJob](https://docs.aws.amazon.com/bedrock/latest/APIReference/API_agent_StartIngestionJob.html); [Bedrock API: ListIngestionJobs](https://docs.aws.amazon.com/bedrock/latest/APIReference/API_agent_ListIngestionJobs.html); [Bedrock API: StopIngestionJob](https://docs.aws.eu/bedrock/latest/APIReference/API_agent_StopIngestionJob.html)
- A separate limit of 10 concurrent `IngestKnowledgeBaseDocuments`/`DeleteKnowledgeBaseDocuments` requests per account applies to direct/custom data sources, and automated syncs firing in quick succession can hit limits. — [re:Post: documents in queue](https://repost.aws/questions/QU-wvRXZt6T4K8nxjRvGO_UQ/documents-in-queue-with-bedrock-knowledge-base-custom-datasource); [re:Post: maxingestionfilecountperjob](https://repost.aws/questions/QUslRmvzolSV-7QhoBuh5Gmw/maxingestionfilecountperjob-error-in-knowledge-base-syncing-no-failed-files)

### Inferences
- **Identity:** never use the root user day to day. Create one IAM Identity Center user (or, quicker for a hackathon, one IAM user) per person, each with its own CLI profile (`aws configure sso --profile saboot-hg` or access keys in `saboot-hg`). This makes CloudTrail attributable and lets you see who deployed what. Enable MFA on root and lock it away. Optionally use a permission boundary so personal stages can't touch `demo` resources (tag- or name-prefix-based). Given the time limit, a naming convention plus "only CI deploys demo" is enough.
- **Stage naming:** `saboot-<stage>-<resource>`, with stages `hg` (Hemang), `gg` (Girish), `hk` (Harshit), and `demo` (shared, judged). Every resource name, stack name, table name and S3 prefix includes the stage, e.g. `saboot-gg-agent` (stack), `saboot-gg-sessions` (DynamoDB table), `s3://saboot-data-<acct>/gg/...`.
- **SAM (if used for the Lambdas):** one stack per stage via `samconfig.toml` environments, `sam deploy --config-env gg` with `stack_name = "saboot-gg"` and `parameter_overrides = "Stage=gg"`. Each template resource uses `!Sub "saboot-${Stage}-..."` names, or omits explicit names so CFN generates unique ones. CloudFormation refuses a concurrent update to the same stack, so separate stacks per person avoid "stack in UPDATE_IN_PROGRESS" collisions. This is general CFN behavior, not re-verified here. CDK equivalent: `cdk deploy -c stage=gg` with the stage in stack IDs. Terraform would need remote state with locking per workspace; avoid adding it for a 3.5-day build.
- **Amplify:** if the backend is an Amplify Gen 2 `amplify/` folder, `npx ampx sandbox` is the per-developer stage and is already namespaced by OS username. Ensure the three laptops' `whoami` values differ. A generic Windows username like `user` could collide; check `--identifier` in `npx ampx sandbox --help`. If the Lambdas are deployed with SAM/CDK instead, Amplify only hosts the frontend. Each developer then runs the frontend locally against their own stage's Function URL via `frontend/.env.local` (`VITE_API_URL=...`), copied into worktrees by `.worktreeinclude`, and only Amplify's `main`/`demo` branch points at the `demo` stage URL.
- **Who deploys `demo`:** only CI (a GitHub Actions workflow on push to `main`, using an OIDC role or one deploy key) or one named person (the infra owner). Agents never deploy to `demo`. Add a Bash deny pattern for `--config-env demo`, `stage=demo` and `Stage=demo` in Claude Code permissions.
- **DynamoDB:** one table set per stage. On-demand tables cost nothing when idle, so per-stage duplication is cheap. Seed data comes from `contracts/fixtures` through a seed script per stage.
- **S3 data outputs:** the offline pipelines write to `s3://.../<stage>/<dataset>/<version>/` and never overwrite another stage's prefix. `demo` data is promoted by an explicit copy step run by the data owner.
- **Bedrock Knowledge Base:** a vector-store-backed KB (especially on OpenSearch Serverless) may carry a standing cost and slow setup, so per-developer KBs are probably not worth it (cost unverified; check the current vector-store options in the console). Instead:
  - Create **one** KB (plus at most one `dev` KB if experimentation is heavy) whose data source points at the `demo/` S3 prefix only.
  - **Only the data/KB owner starts ingestion jobs**, and that owner's script calls `ListIngestionJobs` first and waits if one is running. Ingestion is limited to one job per data source.
  - Other developers' agent stages read the shared KB (retrieval is read-only and doesn't collide). Parameterize the KB ID per stage via env var anyway, so a `dev` KB can be swapped in.
- **Bedrock model access and quotas** are account-wide. Several developers plus agents running evals at the same time share the same on-demand throughput quotas, so throttling under parallel testing is possible. Keep automated tests on mocks or fixtures rather than live model calls.
- **Cost and cleanup:** tag everything `project=saboot, stage=<stage>, owner=<name>`, and delete personal stacks (`sam delete --stack-name saboot-gg` / `npx ampx sandbox delete`) after the event.

### Gaps
- Official Bedrock KB ingestion quotas (5 per account, 1 per KB and data source) come from secondary summaries of an AWS blog. I did not fetch the Service Quotas page or confirm values for ap-south-1 in Oct 2026.
- I didn't fetch AWS SAM or CDK environment docs, so the SAM/CDK stage commands are from general knowledge.
- The `npx ampx sandbox --identifier` flag was not shown on the page I fetched and is unverified.
- Current vector-store options and costs for Bedrock KBs in ap-south-1 (OpenSearch Serverless vs. S3 Vectors vs. Aurora) were not researched.

## 8. Recommended concrete setup for Saboot (synthesis)

### Takeaway
Spend about 2 hours on day 1: initial commit, repo skeleton and `.gitattributes`, contracts plus fixtures, CI, Claude Code settings and hooks, and AWS profiles and stages. Then each person runs 2–4 Claude Code worktree agents confined to their own directory. Every agent task ends in a small PR to `main` that merges only on green CI, while `demo` is deployed only by CI or the infra owner.

### Cited Findings
- `claude -w <name>` creates `.claude/worktrees/<name>` on branch `worktree-<name>`. It requires at least one commit, branches from `origin/HEAD` by default, and copies gitignored files listed in `.worktreeinclude`. — [Claude Code: Worktrees](https://code.claude.com/docs/en/worktrees); [Common workflows](https://code.claude.com/docs/en/common-workflows)
- Hooks go in committed `.claude/settings.json`. PreToolUse can deny, Stop can block until tests pass, and Windows hooks run in Git Bash or PowerShell. — [Claude Code: Hooks](https://code.claude.com/docs/en/hooks)
- Short-lived branches, one owner per branch, merged via PR with CI. — [trunkbaseddevelopment.com](https://trunkbaseddevelopment.com/short-lived-feature-branches/)
- Merge queue and branch protection depend on plan and visibility. Public org repos get both free. — [GitHub changelog](https://github.blog/changelog/2023-07-12-pull-request-merge-queue-is-now-generally-available/); [SSW](https://www.ssw.com.au/rules/which-github-plan)
- Amplify sandboxes are per developer (`amplify-<app>-<whoami>-sandbox`). — [Amplify docs](https://docs.amplify.aws/react/deploy-and-host/sandbox-environments/setup/)

### Inferences
**A. Hour 0–0.5: repo bootstrap (one person, e.g. Girish since the repo is on his machine)**
```bash
# Windows, every member, once (elevated shell for --system; or use --global)
git config --global core.longpaths true
# Every member, once
git config --global rerere.enabled true
git config --global user.name "<Name>"; git config --global user.email "<github-email>"

# Repo owner
cd C:\Coding\saboot
# add to .gitignore: .claude/worktrees/  .env  .env.*  !.env.example  .venv/  node_modules/  dist/  .agent-scope  .claude/settings.local.json
# create .gitattributes (below), skeleton dirs, CLAUDE.md per area
git add -A && git commit -m "chore: initial skeleton"     # dated Oct 8 2026, inside event window
gh repo create <org>/saboot --public --source . --push      # public org repo => branch protection + merge queue on Free
```
Also turn on Windows `LongPathsEnabled` (Group Policy or registry) on Windows machines.

`.gitattributes`:
```
* text=auto eol=lf
*.ps1 text eol=crlf
*.png binary
*.geojson -diff
frontend/src/api/generated/** linguist-generated=true
services/shared/generated/** linguist-generated=true
docs/LOG.md merge=union
```

`.worktreeinclude`:
```
.env
.env.local
frontend/.env.local
services/**/.env
.agent-scope
```

**B. Hour 0.5–1.5: contracts and mocks (all three together, then split)**
- `contracts/openapi.yaml`, `contracts/schemas/*.schema.json`, `contracts/fixtures/*.json`, merged as PR #1. Frontend mock mode reads fixtures. The agent Lambda has a fixture-driven test. Data scripts validate outputs against schemas.
- Example ownership (adjust to actual roles): Hemang owns `frontend/`; Girish owns `services/` and `infra/`; Harshit owns `data/` and the Bedrock KB; `contracts/` is owned by whoever owns the API (Girish), and changes need a second person's approval.
- `.github/CODEOWNERS` (enforced if the repo is public or on a paid plan):
  ```
  /frontend/   @hemang-gh
  /services/   @girish-gh
  /infra/      @girish-gh
  /data/       @harshit-gh
  /contracts/  @girish-gh @hemang-gh @harshit-gh
  /.github/    @girish-gh
  ```

**C. Branch and PR rules**
- `main` is protected: PR required, required status checks (`frontend`, `python`, `contracts`), no force-push, linear history optional. Required reviews: 0 (CI is the gate, to keep speed), except `contracts/` and `infra/` via CODEOWNERS. If public under an org, enable merge queue and add `merge_group` to CI triggers.
- Agent branches use Claude Code's naming automatically: `worktree-<initials>-<area>-<task>`, e.g. `claude -w hg-fe-legend` creates branch `worktree-hg-fe-legend`.
- Each PR covers one task, one owned directory, and ideally under 400 changed lines. The agent writes the PR description (what changed, conflicts resolved, how tested). The person who launched the agent merges it, which keeps the "all members commit" rule satisfied.
- Sync with `origin/main` before opening the PR and whenever `contracts/` or a lockfile changes. Delete merged branches automatically (repo setting).
- Amplify: `main` builds to the dev URL. Optionally a `demo` branch is fast-forwarded by hand (`git push origin main:demo`) before judging. PR previews are off.

**D. Worktree conventions (per person, 2–4 agents each)**
```bash
cd C:\Coding\saboot
git pull
echo "frontend/**" > .agent-scope          # allowed globs for the next agent(s); copied via .worktreeinclude
claude -w hg-fe-legend                    # agent 1
claude -w hg-fe-search                    # agent 2 (new terminal)
# inside each worktree (first time):  cd frontend && npm ci && npm run dev -- --port 5174
# python agents:  cd services/agent && uv sync
```
- Keep at most one agent per directory subtree at a time, plus any number of read-only research or scout agents (Simon Willison's pattern).
- Use explicit dev-server ports per person and worktree. Remove worktrees after merge (`git worktree remove .claude/worktrees/hg-fe-legend`, or let Claude's exit prompt do it). Run `git worktree prune` daily.
- Subagents inside a session that edit files should use `isolation: worktree` (frontmatter) when they write in parallel.

**E. `.claude/settings.json` (committed), sketch**
```json
{
  "permissions": {
    "deny": [
      "Bash(git push --force*)", "Bash(git push origin main*)", "Bash(*--no-verify*)",
      "Bash(*config-env demo*)", "Bash(*Stage=demo*)", "Bash(aws bedrock-agent start-ingestion-job*)"
    ]
  },
  "hooks": {
    "PreToolUse": [{ "matcher": "Edit|Write|NotebookEdit",
      "hooks": [{ "type": "command", "command": "node",
                  "args": ["${CLAUDE_PROJECT_DIR}/.claude/hooks/scope-guard.mjs"], "timeout": 10 }]}],
    "Stop": [{ "hooks": [{ "type": "command", "command": "node",
                  "args": ["${CLAUDE_PROJECT_DIR}/.claude/hooks/area-tests.mjs"], "timeout": 180 }]}]
  }
}
```
(Deny-rule pattern syntax and the Stop loop-guard field should be checked against the current settings/hooks reference. `scope-guard.mjs` reads `cwd` plus `tool_input.file_path` and denies paths outside `.agent-scope` or in the protected list.)

**F. CI (`.github/workflows/ci.yml`)**
- Triggers on `pull_request` (and `merge_group` if a queue is used) and `push: main`. Path-filtered jobs for `frontend` (npm ci, lint, `tsc --noEmit`, test, build), `python` (`uv sync --frozen`, ruff, pytest per service and pipeline), and `contracts` (validate fixtures against schemas, regenerate types, fail on diff). Use `concurrency: ci-${{ github.ref }}` with `cancel-in-progress: true`.
- A `deploy-demo` job on push to `main` (after the checks) is the only path that deploys the `demo` stack. It is followed by a smoke test (curl the Function URL with a fixture, validate against the schema).

**G. AWS**
- Three IAM users or Identity Center users plus profiles `saboot-hg`, `saboot-gg`, `saboot-hk`. Region `ap-south-1` is pinned in the profile and `samconfig.toml`.
- Stages `hg`, `gg`, `hk`, `demo`. Names follow `saboot-<stage>-*`, with tags `project/stage/owner`.
- Per-stage Lambda stacks, Function URLs and DynamoDB tables. S3 prefixes are per stage. There is one shared Bedrock KB on the `demo/` prefix, ingested only by Harshit's script (check `ListIngestionJobs` first). The KB ID is env-configurable.
- Frontend local dev reads `VITE_API_URL` from `frontend/.env.local` pointing at the developer's own stage, and Amplify's env vars point at `demo`.

**H. Daily cadence**
- Morning (10 min): each person states which directories their agents will touch today. Contract changes are agreed and merged first.
- Every 2–3 hours: merge green PRs, everyone pulls, restart long-running agents from fresh `origin/main` rather than letting them drift.
- From the final evening on: freeze `contracts/` and `infra/`, allow only fixes, promote `main` to `demo` once, and run the smoke test.

### Gaps
- Exact Claude Code `permissions.deny` pattern semantics (glob vs. prefix matching for Bash rules) were not confirmed this session.
- Whether Saboot's backend uses Amplify Gen 2 (`amplify/` folder) or SAM/CDK is unknown, and it changes how per-developer stages are created.
- The hackathon's rules on public repos and on AI-tool usage were not checked.
- The 2-hour setup estimate is my judgment, not measured.
