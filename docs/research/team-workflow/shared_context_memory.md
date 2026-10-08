# Shared context, memory and decision history across many parallel coding agents (Saboot, 3 people, 3.5 days)

Scope note: researched 8 Oct 2026. Source dates are given inline. Anything dated before 2026 is flagged where it may be outdated. Claude Code docs (code.claude.com) were fetched live and reflect current versions (they reference v2.1.2xx features). The repo already has `CLAUDE.md` (21 lines: event rules + product rules) and `docs/research/*.md`; there is no `AGENTS.md`, `.claude/`, or decision/progress file yet (checked locally: `C:\Coding\saboot`).

## 1. What current context-engineering guidance says about multi-agent context loss, and how to counter it

### Takeaway
Every major source agrees on the failure mechanism: parallel agents that do not see each other's context make conflicting implicit decisions. Cognition's April 2026 follow-up keeps that view and adds a fix: many agents may read, analyze and review, but "writes stay single-threaded". Anthropic's countermeasures are concrete and file-based: a progress file, a JSON feature list, git history, an init script, structured notes, and subagents that return condensed summaries. Together they are the best available template for rebuilding "single-agent coherence" across many sessions.

### Cited Findings
**Cognition, "Don't Build Multi-Agents" (Walden Yan, 12 Jun 2025; partly superseded by the 2026 follow-up below)**
- Principle 1: "Share context, and share full agent traces, not just individual messages." Principle 2: "Actions carry implicit decisions, and conflicting decisions carry bad results." — [Cognition 2025](https://cognition.com/blog/dont-build-multi-agents)
- Flappy Bird example: two subagents each built half of a Flappy Bird clone. One built a Super Mario-style background and the other a bird that did not match it. The styles conflicted because nobody set the assumptions up front, even though both had shared context. — [Cognition 2025](https://cognition.com/blog/dont-build-multi-agents)
- It recommends a single-threaded linear agent. For long tasks it suggests a separate LLM that compresses the history into "key details, events, and decisions", while noting this is hard to get right. — [Cognition 2025](https://cognition.com/blog/dont-build-multi-agents)
- In June 2025 Claude Code subagents did not run in parallel with the main agent and mostly answered narrow questions rather than writing code. (Outdated: Claude Code now has background subagents and parallel sessions.) — [Cognition 2025](https://cognition.com/blog/dont-build-multi-agents)

**Cognition, "Multi-Agents: What's Actually Working" (Walden Yan, 22 Apr 2026, the current position)**
- Patterns that work in 2026:
  - Single-writer systems: multi-agent works best when "writes stay single-threaded".
  - Generator-verifier review loops: Devin Review catches about 2 bugs per PR, roughly 58% of them severe. The reviewer works best with a clean context that does not share the coder's prior context.
  - "Smart friend" escalation to a stronger model.
  - Manager-child "map-reduce-and-manage" delegation. Unstructured swarms are called a distraction.
  — [Cognition 2026](https://cognition.com/blog/multi-agents-working)
- What still fails:
  - Child agents assume they share state with the parent.
  - Cross-agent communication does not happen by default.
  - Managers without deep codebase context are over-prescriptive.
  - Open problem: how children surface discoveries that affect their siblings.
  — [Cognition 2026](https://cognition.com/blog/multi-agents-working)
- Recommendations:
  - Share as much context as possible, including sources, plan/todo files and shared assumptions.
  - When parallel agents make conflicting writes, decisions fragment, so keep writes single-threaded and let other agents contribute analysis.
  — [Cognition 2026](https://cognition.com/blog/multi-agents-working)

**Anthropic, "Effective harnesses for long-running agents" (Justin Young, 26 Nov 2025)**
- Problem: each new session starts with no memory, and compaction alone was not enough.
- Observed failure modes:
  - "One-shotting": building too much at once, running out of context mid-feature, and leaving work half-done and undocumented.
  - Declaring victory early after seeing earlier progress.
  - Marking features done without end-to-end testing.
  - Wasting time working out how to run the app.
  — [Anthropic harness post](https://www.anthropic.com/engineering/effective-harnesses-for-long-running-agents)
- Mechanisms:
  1. An initializer session creates `init.sh`, `claude-progress.txt` and an initial git commit.
  2. A `feature_list.json` holds 200+ features, all initially failing, each with category, description, test steps and a `passes` field.
  3. Every later session works one feature at a time and leaves code in a mergeable "clean state".
  4. Descriptive git commits make it possible to revert.
  5. Agents append progress summaries to `claude-progress.txt`.
  6. `init.sh` starts the app, and a basic end-to-end check runs before new work.
  — [Anthropic harness post](https://www.anthropic.com/engineering/effective-harnesses-for-long-running-agents)
- Why JSON: the model "is less likely to inappropriately change or overwrite JSON files compared to Markdown files". Agents may only flip `passes`, and "It is unacceptable to remove or edit tests". — [Anthropic harness post](https://www.anthropic.com/engineering/effective-harnesses-for-long-running-agents)
- Start-of-session ritual: run `pwd`, read the git log and the progress file, read the feature list, pick the highest-priority unfinished feature, run `init.sh`, and verify existing functionality before coding. — [Anthropic harness post](https://www.anthropic.com/engineering/effective-harnesses-for-long-running-agents)

**Anthropic, "Effective context engineering for AI agents" (29 Sep 2025)**
- "Context rot": recall degrades as the window fills, and every token draws down an "attention budget". — [Anthropic context engineering](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents)
- Recommendations:
  - Write system prompts at the "right altitude": start minimal and add instructions based on observed failures.
  - Use just-in-time retrieval: keep lightweight identifiers such as file paths and load content at runtime.
  - Claude Code puts CLAUDE.md in context up front, and glob/grep fetch the rest just in time.
  — [Anthropic context engineering](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents)
- Three long-horizon techniques:
  - Compaction: Claude Code keeps the summary plus the 5 most recently accessed files.
  - Structured note-taking: to-do lists, a NOTES.md file.
  - Sub-agent architectures: a subagent may use "tens of thousands of tokens or more" but returns a condensed summary of about 1,000-2,000 tokens.
  — [Anthropic context engineering](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents)

**Anthropic, "How we built our multi-agent research system" (13 Jun 2025)**
- Token cost: agents use about 4x the tokens of chat, and multi-agent systems about 15x. Multi-agent beat single-agent by 90.2% on their research eval. — [Anthropic multi-agent research](https://www.anthropic.com/engineering/multi-agent-research-system)
- Explicitly poor fits for multi-agent: coding (fewer truly parallelizable subtasks), domains where all agents must share the same context, and tasks with many inter-agent dependencies. — [Anthropic multi-agent research](https://www.anthropic.com/engineering/multi-agent-research-system)
- Memory mechanisms:
  - The lead agent saves its plan to external Memory because context is truncated past 200k tokens.
  - Subagents write outputs to external storage and pass lightweight references back, avoiding a "game of telephone".
  — [Anthropic multi-agent research](https://www.anthropic.com/engineering/multi-agent-research-system)
- Delegation: each subagent needs "an objective, an output format, guidance on the tools and sources to use, and clear task boundaries". Vague delegation caused duplicated work. — [Anthropic multi-agent research](https://www.anthropic.com/engineering/multi-agent-research-system)

**Practitioners**
- Harper Reed (16 Feb 2025, old but still cited): uses `spec.md`, `prompt_plan.md` and `todo.md`, and the agent checks off `todo.md`, which "is good for keeping state across sessions". He calls the workflow "single player mode": in teams "The bots collide, the merges are horrific, the context complicated." — [Harper Reed](https://harper.blog/2025/02/16/my-llm-codegen-workflow-atm/)
- Ralph loop (Geoffrey Huntley, via Steve Kinney's course; secondary source):
  - Fresh-context iterations driven by a fixed prompt.
  - An `AGENTS.md` of about 60 lines on how to build and test.
  - A `specs/` folder with one file per topic.
  - A throwaway `fix_plan.md`/`IMPLEMENTATION_PLAN.md` that is regenerated when stale.
  - Long sessions degrade because "early decisions get buried".
  — [Kinney on Ralph](https://stevekinney.com/courses/ai-development-setup/the-ralph-loop)

### Inferences
- For Saboot, "single-agent coherence" can't come from sharing chat transcripts across 3 laptops. It has to come from (a) a small set of repo files that every session reads at start and writes at end, and (b) a single-writer rule per area of code.
- Cognition's 2026 single-writer rule maps cleanly onto the team:
  - Each human owns one area: frontend/Amplify, Lambda/Strands agent, offline data scripts.
  - That person's parallel agents each get one disjoint task in their own worktree/branch.
  - Cross-area changes go through a written contract file, never through two agents editing the same module.
- The Flappy Bird failure is exactly the risk where the React map, the Lambda API and the DynamoDB/S3 layout meet. Fix the shared assumptions before parallel work starts: API request/response shapes, table keys, S3 key layout, naming, and the citation rule. The repo's "Every rule cited must come from a retrieved document" rule is the kind of cross-cutting decision every agent must see.
- Anthropic's harness pattern needs adapting from one agent over many sessions to three people over many sessions:
  - Keep its ideas: JSON feature list with a `passes` flag, progress log, start-of-session ritual, clean state at the end of every session.
  - Change the storage so it doesn't conflict, for example per-person or per-session files, or GitHub Issues (see section 3).
- Using a fresh-context reviewer agent (Cognition 2026) is cheap and directly useful: one review agent per PR, started without the coder's history.

### Gaps
- The Cognition 2026 post was fetched once in summarized form. Exact quotes beyond "writes stay single-threaded" were not verified against the page text.
- No source quantifies how much coherence is lost when three humans each run several agents. All evidence is either single-team anecdote or single-agent harness work.

## 2. How repo-level instruction/memory files work across tools, and how to keep one source of truth (incl. symlinks on Windows)

### Takeaway
`AGENTS.md` is now the cross-tool standard. Codex, Cursor, Kiro, Copilot, Gemini CLI, Devin and others read it, and current Claude Code reads it natively too, but only when no `CLAUDE.md` exists. Saboot already has a `CLAUDE.md`, so the robust single source of truth is: put the shared content in `AGENTS.md`, and make `CLAUDE.md` a thin file whose first line is `@AGENTS.md`. Do not use a symlink. Anthropic's own docs say Windows users should use the import, because symlinks need admin rights or Developer Mode and Git may check them out as plain text files.

### Cited Findings
**Claude Code (code.claude.com/docs/en/memory, current)**
- Locations:
  - Managed policy (Windows: `C:\Program Files\ClaudeCode\CLAUDE.md`).
  - Project: `./CLAUDE.md` or `./.claude/CLAUDE.md`, shared via git.
  - User: `~/.claude/CLAUDE.md`.
  - Local: `./CLAUDE.local.md`, gitignored and personal.
  — [Claude Code memory docs](https://code.claude.com/docs/en/memory)
- Loading:
  - Files in the working directory and every directory above it load at launch.
  - Files in subdirectories load on demand when Claude works there.
  - All discovered files are concatenated, not overridden, ordered root-first, with `CLAUDE.local.md` appended after `CLAUDE.md` at each level.
  — [Claude Code memory docs](https://code.claude.com/docs/en/memory)
- Imports:
  - `@path/to/file` syntax; paths are relative to the importing file.
  - Imports can recurse to a maximum depth of four hops.
  - Imported files load at launch, so they "don't reduce its context cost".
  - Paths containing spaces need backslash escapes.
  - Imports pointing outside the working directory trigger a one-time approval dialog.
  — [Claude Code memory docs](https://code.claude.com/docs/en/memory)
- `.claude/rules/*.md`:
  - Rules without `paths:` frontmatter load every session.
  - Rules with `paths:` globs load only when Claude reads, writes or edits a matching file.
  - The directory supports symlinks, but symlinks pointing outside the project need approval, and UNC network paths are not followed.
  — [Claude Code memory docs](https://code.claude.com/docs/en/memory)
- Auto memory:
  - Stored at `~/.claude/projects/<project>/memory/` with a `MEMORY.md` index plus topic files.
  - The first 200 lines or 25KB of `MEMORY.md` load every session; topic files are read on demand.
  - Memory types: `user`, `feedback`, `project` ("ongoing work, deadlines, and decisions that Claude can't derive from the code or git history") and `reference`.
  - Scope: "Auto memory is machine-local. All worktrees and subdirectories within the same git repository share one auto memory directory. Files are not shared across machines or cloud environments."
  - It is not loaded into subagents, except forks.
  - It can be disabled per project with `"autoMemoryEnabled": false`, or relocated with `autoMemoryDirectory`, which must be an absolute or `~/` path.
  — [Claude Code memory docs](https://code.claude.com/docs/en/memory)
- `/memory` browses and opens memory files and toggles auto memory. A prompt audit (`/doctor prompt-audit`) finds contradictory instructions across CLAUDE.md, rules, skills and AGENTS.md. — [Claude Code memory docs](https://code.claude.com/docs/en/memory)

**AGENTS.md in Claude Code (current)**
- Direct reading:
  - Claude Code reads `AGENTS.md` directly only when there is no `CLAUDE.md`, `.claude/CLAUDE.md` or `CLAUDE.local.md` in the working directory or above it. Otherwise it reads "Your CLAUDE.md files only".
  - Direct reading requires v2.1.277+.
  - Before v2.1.281, some sessions read CLAUDE.md only, explicitly including "those on Amazon Bedrock".
  — [Claude Code memory docs](https://code.claude.com/docs/en/memory)
- Recommended setup:
  - Put `@AGENTS.md` at the top of `CLAUDE.md` and add Claude-specific notes below it. This "never makes Claude read AGENTS.md twice".
  - A setting `claude-md-and-agents-md` (set in user settings, not project settings) loads both.
  - Adding a personal `CLAUDE.local.md` to an AGENTS.md-only repo stops Claude from reading AGENTS.md for that person.
  — [Claude Code memory docs](https://code.claude.com/docs/en/memory)
- Symlink caveats, quoted from the docs:
  - "Windows: if you or anyone who clones the repository works on Windows, use the `@AGENTS.md` import instead. Creating a symlink there needs Administrator privileges or Developer Mode, and Git checks a committed symlink out as a plain text file unless `core.symlinks` is enabled, which leaves that clone with a one-line `CLAUDE.md` in place of your instructions."
  - Claude's Edit and Write tools also refuse to write through a symlink.
  — [Claude Code memory docs](https://code.claude.com/docs/en/memory)

**AGENTS.md standard**
- Stewardship and adoption: "stewarded by the Agentic AI Foundation" under the Linux Foundation; used by 60,000+ open-source projects. — [agents.md](https://agents.md/)
- Tools listed as reading it: OpenAI Codex, Google Jules, Factory, Aider, goose, opencode, Zed, Warp, VS Code, Devin, UiPath, JetBrains Junie, Amp, Cursor, RooCode, Gemini CLI, Kilo Code, Phoenix, Semgrep, GitHub Copilot, Ona, Windsurf and Augment Code. — [agents.md](https://agents.md/)
- Precedence rules: nested files are allowed, and "the closest AGENTS.md to the edited file wins". Explicit user prompts override AGENTS.md. — [agents.md](https://agents.md/)

**Codex (OpenAI)**
- Global file: `~/.codex/AGENTS.override.md` or `AGENTS.md`.
- Repo files: Codex walks from the git root down to the cwd, taking at most one file per directory (`AGENTS.override.md`, then `AGENTS.md`, then any configured `project_doc_fallback_filenames`). Files are concatenated root-first, so closer files override.
- Size cap: combined size is capped by `project_doc_max_bytes`, default 32 KiB.
- The docs do not mention CLAUDE.md as a default fallback.
— [Codex AGENTS.md docs](https://learn.chatgpt.com/docs/agent-configuration/agents-md) (redirected from developers.openai.com/codex/guides/agents-md)

**Kiro**
- Steering files:
  - Workspace steering lives in `.kiro/steering/*.md`, global steering in `~/.kiro/steering/`, and workspace wins on conflict.
  - Foundation files are `product.md`, `tech.md` and `structure.md`.
  - Inclusion modes are set in front matter: `always` (default), `fileMatch` with `fileMatchPattern`, `manual` (`#name`) and `auto` (by description).
  - Files can pull in other files with `#[[file:<path>]]`.
  — [Kiro steering docs](https://kiro.dev/docs/steering/)
- AGENTS.md: Kiro reads AGENTS.md at the workspace root, in subdirectories and in `~/.kiro/steering/`. These are always included and do not support inclusion modes. Steering is not auto-included for custom agents. — [Kiro steering docs](https://kiro.dev/docs/steering/)

**Cursor**
- Project rules live in `.cursor/rules/` and must be `.mdc`; a plain `.md` file there is ignored.
- Front matter fields: `description`, `globs`, `alwaysApply`. These give four modes: Always Apply, Apply to Specific Files, Apply Intelligently, Apply Manually.
- Cursor reads AGENTS.md at the root and nested, with more specific files taking precedence.
- Team Rules (Team plan) take precedence over Project Rules, which take precedence over User Rules.
- Keep rules under 500 lines.
— [Cursor rules docs](https://cursor.com/docs/context/rules)

### Inferences
- Recommended single source of truth for Saboot:
  - Move the shared content of today's `CLAUDE.md` (event rules, product rules, repo map, workflow protocol) into `AGENTS.md`.
  - Replace `CLAUDE.md` with `@AGENTS.md` plus a few Claude-only lines (hooks, skills, `/handoff`).
  - Result: Claude Code (any version, including Bedrock-backed sessions), Codex, Cursor and Kiro all read the same text, with no symlinks and no per-tool copies.
- Do not create `.cursor/rules`, `.kiro/steering` or Codex overrides unless a teammate actually adopts that tool. If someone uses Kiro, one `fileMatch` steering file that `#[[file:docs/contracts.md]]`-includes the contracts is enough.
- Nobody should add a `CLAUDE.local.md` unless the `@AGENTS.md` import is in `CLAUDE.md`. The import pattern makes this safe, which is another reason to prefer it.
- Auto memory is a coherence hazard across three laptops. Its `project` type is designed to store "decisions ... that Claude can't derive from the code", but it stays private to one machine. Three people's Claude sessions will build three divergent private memories of team decisions.
  - Mitigation: an AGENTS.md line saying "team decisions go in `docs/decisions/`, not auto memory".
  - Optionally, `autoMemoryEnabled: false` in the project `.claude/settings.json`. This trade-off is a judgment call. Auto memory still helps with personal preferences, so the light mitigation is probably enough.
- Pointing `autoMemoryDirectory` at a folder inside the repo to share it via git is technically possible, since any settings scope can set it. It is not advisable: the `MEMORY.md` index would become a merge-conflict hotspot, and memories are written without review.

### Gaps
- No primary source confirmed whether Kiro reads `CLAUDE.md`. Assume it does not.
- The default value of `core.symlinks` in Git for Windows was not re-verified for 2026. The Claude docs' warning is sufficient grounds to avoid symlinks.
- The Cursor docs fetched did not mention legacy `.cursorrules` or symlink behavior.

## 3. Patterns for recording decisions and progress so a fresh agent can pick up, and how to avoid merge-conflict hotspots

### Takeaway
Use separate stores for separate kinds of memory:
- Durable rules in AGENTS.md.
- Decisions as one small file each, with a status field.
- Progress and handoff in per-person files.
- Tasks with status where no two writers touch the same file: GitHub Issues, or one-file-per-task, or a JSON list owned by one person.

Shared single files that everyone appends to (a `PROGRESS.md`, a `TODO.md`, a `CHANGELOG.md`) are the classic conflict hotspot. Git's `merge=union` only partly helps, and GitHub's web merge is unlikely to honor it.

### Cited Findings
- **ADRs/decision logs for agents (2026 practitioners):**
  - Duncan Davidson keeps ADRs in `docs/decisions/` and tells agents in AGENTS.md how to treat each status:
    - "Treat accepted ADRs as binding. Proposed ADRs are non-binding context. Superseded ADRs are historical context."
    - On a conflict with an accepted ADR, "stop and discuss ... and propose the change".
  - He warns that ADRs bloat into "overlitigated prose" when clarifications pile up as amendments.
  - He also notes that persistent agent memory may preserve context "without establishing whether it is accurate, current, or accepted by the human team".
  — [Davidson, "Coding agents love decision records"](https://duncandavidson.com/agents-love-decisions)
- Benjamin Cane (28 May 2026): agents "only know what you capture"; there is no hallway context. He suggests exposing ADRs to agents via MCP or by adding an architecture repo as an extra directory. — [Cane 2026](https://bencane.com/posts/2026-05-28-coding-agent-architectural-context/)
- **Progress files and feature lists:**
  - Anthropic's `claude-progress.txt` plus `feature_list.json`, with only `passes` editable, plus git commits. — [Anthropic harness post](https://www.anthropic.com/engineering/effective-harnesses-for-long-running-agents)
  - Harper Reed's `todo.md` checklist. — [Harper Reed](https://harper.blog/2025/02/16/my-llm-codegen-workflow-atm/)
  - Ralph-style regenerable `fix_plan.md`. — [Kinney](https://stevekinney.com/courses/ai-development-setup/the-ralph-loop)
- **Beads (Steve Yegge):** a git-backed issue tracker for agents.
  - Flat markdown plans have "no dependencies, no priority ordering, no machine-readable structure, and no compaction strategy".
  - Storage is a Git-committed JSONL file with a local SQLite cache.
  - Hash-derived IDs exist "to prevent merge collisions in multi-agent/multi-branch workflows".
  - At session start an agent picks the top-priority item that has no open blockers.
  - The project is pre-1.0, and the repo may have moved to a "gastownhall" org.
  — [Morph on Beads](https://www.morphllm.com/beads-agent-memory); [VirtusLab on Beads](https://virtuslab.com/blog/ai/beads-give-ai-memory/)
- **Claude Code Tasks (third-party sources, not official docs):**
  - Launching sessions with the same `CLAUDE_CODE_TASK_LIST_ID` makes them share one task list with dependencies, stored under `~/.claude/tasks/`, so it is machine-local.
  - Sources disagree on the storage layout, and concurrency behavior is undocumented.
  — [ClaudeLog](https://www.claudelog.com/faqs/what-are-tasks-in-claude-code/); [claudefa.st](https://claudefa.st/blog/guide/development/task-management)
- **Spec-driven development:**
  - GitHub Spec Kit:
    - Commands: `/speckit-constitution`, `/speckit-specify`, `/speckit-plan`, `/speckit-tasks`, `/speckit-implement`, `/speckit-converge`, plus bug and assess extensions.
    - Has a `.specify/memory` folder.
    - Runs on Linux, macOS and Windows; requires Python 3.11+ and uv.
    - 140.6k stars.
    - The fetched page did not list the per-feature file names (spec.md/plan.md/tasks.md).
    — [GitHub Spec Kit](https://github.com/github/spec-kit)
  - Kiro specs:
    - Three files: `requirements.md` (or `bugfix.md`), `design.md` and `tasks.md`.
    - Task status (in-progress/completed) is tracked in the UI.
    - "Run all tasks" groups tasks into dependency waves that run concurrently.
    - A "Quick Spec" generates all three files without approval gates.
    — [Kiro specs docs](https://kiro.dev/docs/specs/)
- **Merge-conflict mitigation for shared logs:**
  - Git's built-in `merge=union` attribute keeps both sides' lines, but ordering can be random. It broke when a release heading was inserted above Unreleased entries. — [Quantify issue 406](https://gitlab.com/quantify-os/quantify-scheduler/-/issues/406)
  - GitLab (2015) cut changelog conflicts by about 90% using placeholder lines instead. — [GitLab blog 2015](https://about.gitlab.com/blog/2015/02/10/gitlab-reduced-merge-conflicts-by-90-percent-with-changelog-placeholders)
  - A 2016 RuboCop PR reports that GitHub's web UI did not support union merge, so PRs with a conflicting CHANGELOG could not be merged in the browser; the workaround was a local merge. This is old evidence and current GitHub behavior is unverified. — [RuboCop PR 3594](https://github.com/rubocop-hq/rubocop/pull/3594)
  - GitLab does not run custom merge drivers in MRs. — [GitLab issue 18830](https://gitlab.com/gitlab-org/gitlab/-/issues/18830)

### Inferences
- **What creates conflicts.** The real hotspot is any single file that more than one agent appends to or edits. With 3 people × 3-4 agents, a shared `PROGRESS.md` or `TODO.md` will conflict on almost every rebase. These designs remove conflicts structurally:
  - **One file per decision** (`docs/decisions/<YYYYMMDD-HHMM>-<initials>-<slug>.md`). Timestamp plus initials avoids the sequential-number collision (two people both creating `0007-...`), the same idea as Beads' hash IDs.
  - **Per-person status files** (`docs/status/hemang.md`, etc.). Each is overwritten only by its owner's agents, so there are zero cross-person conflicts. Several agents of the same person can still collide, which is why the next point matters.
  - **Per-session handoff notes** as new files (`docs/sessions/<date>-<initials>-<slug>.md`). They are append-only by construction and never edited, so they never conflict. Optional for a 3.5-day project; commit messages plus PR descriptions may be enough.
  - **Tasks in GitHub Issues** (once the remote exists). Status changes are atomic on the server and visible from every machine, and agents can read and update them with `gh issue list/view/comment/close`. Assigning an issue serves as a lock, and `Closes #n` in the PR description records completion. This replaces a shared `TODO.md` or `feature_list.json`, which conflict.
- **Keeping the harness's "JSON feature list".** If the team wants it for its anti-overwrite and anti-"declare victory early" properties, keep a small `docs/features.json` (about 10-15 demo-critical features). Make it single-writer: only the person who integrates `main` flips `passes` after an end-to-end check on the deployed Amplify URL. This matches the event rule "A working feature beats several unfinished ones".
- **Spec-driven tools.** Full Spec Kit or Kiro spec workflows are probably too heavy for 3.5 days if run for every feature. Their useful core is a one-page spec (goal, acceptance checks, out of scope) and a task list per feature. That can live in the GitHub Issue body.
- **`merge=union`.** Adding `docs/**/*.log.md merge=union` to `.gitattributes` is cheap insurance for any file that must be shared and append-only. It only helps when merges or rebases happen locally (`git pull --rebase` before pushing), so it is not a substitute for one-file-per-entry.

### Gaps
- Current (2026) GitHub web-UI behavior for `merge=union` was not confirmed. Test it on a throwaway repo if the team relies on it.
- The current per-feature file names for Spec Kit were not visible on the fetched README. Earlier versions used `specs/NNN-feature/{spec,plan,tasks}.md` and `.specify/memory/constitution.md`, recalled from earlier versions and unverified for 2026.
- No primary Anthropic documentation for `CLAUDE_CODE_TASK_LIST_ID` was fetched, only third-party write-ups.

## 4. Session-continuity features in Claude Code, and community memory tools: reliability and risks

### Takeaway
Claude Code's continuity features (resume, branch, compact, export, auto memory, hooks) are strong within one machine, but none of them share memory across machines. The cross-machine layer has to be git (plus GitHub Issues/PRs). The single most useful hook is a `SessionStart` hook that injects a short, generated "state of the project" briefing, capped at 10,000 characters, on startup, resume, clear and compact.

Third-party MCP memory servers can share memory across teammates. They are young, need a hosted endpoint, and spread one agent's mistake to everyone. That is a poor trade for 3.5 days.

### Cited Findings
**Resume, branch and export (current docs)**
- Resume options: `claude --continue` reopens the most recent session in this directory. `claude --resume` opens a picker, or takes a name, ID or `.jsonl` transcript path. `/resume` switches sessions from inside one. `claude --from-pr <n>` opens the picker filtered to sessions linked to that PR. — [Claude Code sessions docs](https://code.claude.com/docs/en/sessions)
- Other session commands:
  - Name sessions with `-n` or `/rename`.
  - `/branch` or `--fork-session` copies the conversation.
  - Resuming the same session in two terminals without forking interleaves messages into one transcript.
  — [Claude Code sessions docs](https://code.claude.com/docs/en/sessions)
- Transcripts:
  - Stored at `~/.claude/projects/<project>/<session-id>.jsonl`.
  - The format "is internal to Claude Code and changes between versions".
  - 30-day retention by default (`cleanupPeriodDays`).
  - `/export` writes a readable text transcript.
  - `claude -p --resume <id> "summarize what we changed"` can script a summary.
  — [Claude Code sessions docs](https://code.claude.com/docs/en/sessions)
- Resuming a session that has been idle for more than about an hour and is over 100k tokens offers "Resume from summary", which runs `/compact`. — [Claude Code sessions docs](https://code.claude.com/docs/en/sessions)

**What survives compaction**
- Re-injected from disk: project-root CLAUDE.md and unscoped rules, auto memory, and the plan-mode plan.
- Summarized away: nested CLAUDE.md files and path-scoped rules ("If a rule must persist across compaction, drop the `paths:` frontmatter or move it to the project-root CLAUDE.md").
- Files: up to five recently modified files are re-read, and files over 5,000 tokens come back as references only.
- Skills: invoked skill bodies are re-injected, capped at 5,000 tokens per skill and 25,000 total. Skill descriptions are not re-injected.
- Hooks: `SessionStart` hooks matching `compact` run and their output is added.
— [Claude Code context-window docs](https://code.claude.com/docs/en/context-window)

**Hooks (current docs)**
- `SessionStart`:
  - Matchers: `startup`, `resume`, `clear`, `compact`, `fork`.
  - Plain stdout and `additionalContext` are added to Claude's context before the first prompt.
  - It cannot block.
  — [Claude Code hooks docs](https://code.claude.com/docs/en/hooks)
- `PreCompact`: matchers `manual`/`auto`; can block compaction; stdout goes to the debug log, not to Claude. — [Claude Code hooks docs](https://code.claude.com/docs/en/hooks)
- `Stop`: can block Claude from stopping, and `hookSpecificOutput.additionalContext` is placed at the end of the turn. Input includes `last_assistant_message`. — [Claude Code hooks docs](https://code.claude.com/docs/en/hooks)
- `SessionEnd`: side effects only; a default 1.5-second budget, up to 60 seconds with a longer `timeout`. — [Claude Code hooks docs](https://code.claude.com/docs/en/hooks)
- `InstructionsLoaded`: observability only. — [Claude Code hooks docs](https://code.claude.com/docs/en/hooks)
- Injection cap: `additionalContext` and plain stdout are each capped at 10,000 characters. Longer output is saved to a file, and Claude sees only a path plus a 2,000-character preview. — [Claude Code hooks docs](https://code.claude.com/docs/en/hooks)
- Configuration:
  - Hooks in `.claude/settings.json` are committed and shared; `.claude/settings.local.json` is personal.
  - Hook entries merge across levels.
  — [Claude Code hooks docs](https://code.claude.com/docs/en/hooks)
- Windows:
  - The hook `shell` defaults to bash, or to PowerShell if Git Bash isn't installed.
  - In exec form, `command` must be a real `.exe`; `.cmd`/`.bat` npm shims won't spawn.
  - PowerShell scripts can run via `powershell.exe -NoProfile -ExecutionPolicy Bypass -File ...`.
  — [Claude Code hooks docs](https://code.claude.com/docs/en/hooks)
- If Claude Code reads AGENTS.md directly, a `SessionStart` hook that also prints AGENTS.md duplicates it, so remove such a hook. — [Claude Code memory docs](https://code.claude.com/docs/en/memory)

**Community and MCP memory servers**
- Candidates:
  - Memory-MCP: a remote server on Cloudflare Workers + D1 for shared team memory.
  - claude-sync: cross-machine.
  - engrm.
  - ContextStream: a Rust binary pitched at cross-teammate retrieval.
  - A shared-memory server whose demo stores a local JSON file, so it is single-machine.
  — [Glama: Memory-MCP](https://glama.ai/mcp/servers/CedraInteractive/Memory-MCP); [ContextStream](https://contextstream.io/blog/claude-code-memory-between-sessions)
- Caveats from the search summary:
  - Most are young with little visibility.
  - Cross-machine use needs a server every machine can reach.
  - A committed `.mcp.json` shares which server to connect to, not the memories.
  - Team memory means one person's mistaken note reaches everyone.
  — [Glama: Memory-MCP](https://glama.ai/mcp/servers/CedraInteractive/Memory-MCP); [ContextStream](https://contextstream.io/blog/claude-code-memory-between-sessions)

**Risks: stale or contradictory memory and context poisoning**
- Drew Breunig's taxonomy (June 2025, read via secondary coverage, not the original):
  - Context poisoning: an error enters context and is repeatedly referenced.
  - Distraction.
  - Confusion.
  - Clash: new info conflicts with what is already in the prompt.
  — [Breunig, "How Long Contexts Fail"](https://dbreunig.com/2025/06/22/how-contexts-fail-and-how-to-fix-them.html)
- Tian Pan (May 2026) on "ghost context":
  - Append-only vector memories return stale and new facts together.
  - Similarity search has no notion of which fact supersedes which.
  - Cites LongMemEval's about 30% accuracy drop on knowledge-update tasks. That figure came from secondary coverage and was not checked against the paper.
  — [Tian Pan, ghost context](https://tianpan.co/blog/2026-05-05-ghost-context-agent-memory-contradictory-beliefs)
- Redis describes an agent that read a stale cached status, then wrote "confirmed shipment" into its own memory, so poisoning persisted across sessions. — [Redis on context poisoning](https://redis.io/blog/context-poisoning-agent-reasoning/)
- Claude docs: "if two instructions contradict each other, Claude may pick one arbitrarily". Review files periodically or run a prompt audit. — [Claude Code memory docs](https://code.claude.com/docs/en/memory)
- Claude Code adds a `modified` timestamp to frontmatter of memory files it writes, "The timestamp shows how current the fact is". — [Claude Code memory docs](https://code.claude.com/docs/en/memory)

### Inferences
- Per person on one laptop:
  - Name each parallel session after its task (`claude -n lambda-citations`).
  - Use worktrees. Auto memory is shared across worktrees of the same repo, so one person's agents do share auto memory.
  - Use `/compact <focus>` or `/clear` plus a handoff note rather than letting one session run to auto-compact.
- Across people: transcripts are machine-local and version-specific, so don't pass transcripts around. Pass distilled artifacts instead: decision files, status files, PR descriptions. This is what both Anthropic's "condensed summary" and Cognition's "share full context" are approximating.
- Recommended hook: `SessionStart` (matchers `startup|resume|clear|compact`) running a cross-platform Python script (`python .claude/hooks/brief.py`; Python is already in the stack and works in exec form on Windows). It prints at most about 6-8k characters:
  - current branch and `git status -s`;
  - `git log --oneline -15 origin/main`, after a quick `git fetch` with a timeout;
  - the 3 per-person status files, trimmed to their "Now / Next / Blocked / Handoff" headers;
  - titles and status of the last 10 decision files;
  - optionally `gh issue list --assignee @me --state open` with a timeout.
  This re-creates the "I know what's happening" state of a single long-running agent at every start and after every compaction. Keep it under the 10,000-character cap, or the content is silently reduced to a 2,000-character preview.
- Do not use a blocking `Stop` hook to force handoff notes on every turn. It fires every time Claude finishes responding, so it would add friction and token cost to every parallel agent. A `/handoff` skill the human runs before closing a session is lower overhead. A non-blocking reminder via `additionalContext` is a middle ground.
- Avoid MCP memory servers for this hackathon:
  - They add a hosted dependency, auth and security surface.
  - They are a second source of truth that can disagree with the repo.
  - They are exactly the "ghost context" risk.
  - Git-tracked files are reviewable in PRs, timestamped by commits, and supersedable via status fields.
- Poisoning controls that fit 3.5 days:
  - Decisions have `status: accepted|superseded` with a `superseded_by:` pointer, and are never silently edited.
  - Status files are overwritten, not appended, so stale "next steps" disappear.
  - One human (rotating, or the integrator) skims new decision files at each merge.

### Gaps
- Whether PreCompact/PostCompact hook stdout can be routed into context is "not documented" per the fetched page, so it was treated as unavailable.
- No independent reliability data (uptime, data loss) was found for any of the MCP memory servers listed.

## 5. How large shared context files should be, the evidence on adherence decay, and how to structure for progressive disclosure

### Takeaway
Keep the always-loaded files short:
- AGENTS.md/CLAUDE.md under about 150-200 lines (Anthropic: "target under 200 lines"; HumanLayer: under 300, theirs under 60).
- MEMORY.md is hard-capped at 200 lines/25KB.
- Hook injections are capped at 10k characters.

The evidence shows adherence falls as instruction count rises, across all instructions and not only the later ones, with a bias toward earlier instructions. Put only universal, critical rules in the always-loaded file. Push area-specific guidance into path-scoped rules, skills, or docs referenced by path.

### Cited Findings
- Claude Code docs:
  - "target under 200 lines per CLAUDE.md file. Longer files consume more context and reduce adherence."
  - Imports don't reduce context cost.
  - A CLAUDE.md of up to 4 MiB loads in full, but "Shorter files produce better adherence."
  - Multi-step procedures or instructions that only matter for one part of the codebase belong in a skill or a path-scoped rule.
  — [Claude Code memory docs](https://code.claude.com/docs/en/memory)
- IFScale paper:
  - "How Many Instructions Can LLMs Follow at Once?" (Jaroslawicz et al., Jul 2025), testing up to 500 instructions on 20 models.
  - The best frontier models reach only about 68% accuracy at 500 instructions.
  - It finds three degradation patterns tied to model size and reasoning, and a primacy bias toward earlier instructions.
  — [arXiv 2507.11538](https://arxiv.org/abs/2507.11538)
- HumanLayer (25 Nov 2025):
  - Frontier thinking models follow about 150-200 instructions with reasonable reliability.
  - Larger models degrade linearly and smaller ones exponentially.
  - Adherence drops across all instructions as the count rises.
  - Claude Code's system prompt already contains about 50 instructions.
  - Recommends under 300 lines; HumanLayer's own root file is under 60 lines.
  - Use an `agent_docs/` folder of task-specific files listed with one-line descriptions, and prefer `file:line` pointers to code snippets.
  - Claude Code wraps CLAUDE.md in a reminder that "this context may or may not be relevant to your tasks", so non-universal content makes the whole file more ignorable.
  — [HumanLayer](https://www.humanlayer.dev/blog/writing-a-good-claude-md)
- Size caps in other tools:
  - Cursor: keep rules under 500 lines. — [Cursor rules docs](https://cursor.com/docs/context/rules)
  - Codex: all AGENTS.md files combined are capped at 32 KiB by default. — [Codex AGENTS.md docs](https://learn.chatgpt.com/docs/agent-configuration/agents-md)
  - Ralph practice: AGENTS.md of about 60 lines. — [Kinney](https://stevekinney.com/courses/ai-development-setup/the-ralph-loop)
- Progressive disclosure mechanisms in Claude Code:
  - Path-scoped `.claude/rules/` load only when a matching file is read or edited. — [Claude Code memory docs](https://code.claude.com/docs/en/memory)
  - Skills: only one-line descriptions load at startup, and the full body loads when used. — [Claude Code context-window docs](https://code.claude.com/docs/en/context-window)
  - Skills with `disable-model-invocation: true` cost zero context until invoked with `/name`; the docs recommend this for side-effecting skills. — [Claude Code context-window docs](https://code.claude.com/docs/en/context-window)
  - Third-party summaries put skill metadata at about 100 tokens per skill, unverified against primary docs. — [SwirlAI](https://www.newsletter.swirlai.com/p/agent-skills-progressive-disclosure)
- Anthropic context engineering: "the smallest set of high-signal tokens", just-in-time loading, and structured notes outside the window. — [Anthropic context engineering](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents)

### Inferences
- Budget for Saboot:
  - AGENTS.md ≤ about 120 lines, roughly 40-60 rules.
  - Today's CLAUDE.md rules (event + product) are about 12 lines and should sit near the top (primacy bias).
  - Each path-scoped rule file ≤ about 60 lines.
  - Each per-person status file ≤ about 30 lines.
  - Each decision file ≤ about 25 lines.
  - SessionStart briefing ≤ about 6k characters.
- Critical rules that must survive compaction belong in root AGENTS.md (imported via CLAUDE.md), because path-scoped rules are summarized away on compaction:
  - citation-from-retrieved-document only;
  - never name a person;
  - "thermal anomalies", not proof;
  - "candidates";
  - nothing auto-filed;
  - AWS visible.
- Area guidance (React/MapLibre conventions, Strands/Bedrock Lambda patterns, offline data script conventions) goes in `.claude/rules/<area>.md` with `paths:`. Other tools reach it via a nested `frontend/AGENTS.md` etc., since Cursor, Codex and Kiro read nested AGENTS.md. Pick one mechanism per area to avoid duplicates. Nested `AGENTS.md` per top-level folder is the most cross-tool option, and Claude Code also reads a subdirectory's `AGENTS.md` on demand when that subdirectory has no CLAUDE.md.
- Long research (`docs/research/*.md`) should never be imported. Reference it by path with a one-line description of when to read it.

### Gaps
- The IFScale abstract does not name the three degradation patterns. The "linear vs exponential" characterization comes from HumanLayer's reading of the paper.
- No study measures adherence specifically for AGENTS.md/CLAUDE.md files in coding agents. All line-count recommendations are vendor or practitioner heuristics.

## 6. Recommended minimal "shared brain" layout for the Saboot repo

### Takeaway
Use git as the only shared memory bus:
- One canonical `AGENTS.md`, imported by `CLAUDE.md`.
- A `docs/contracts.md` that freezes cross-area interfaces before parallel work starts.
- One-file-per-decision `docs/decisions/`.
- Per-person overwrite-only `docs/status/<name>.md`.
- GitHub Issues as the task board (with an optional single-writer `docs/features.json`).
- A `SessionStart` briefing hook.
- `/handoff` and `/decide` skills.

Together these re-create what a single long-running agent "remembers" (rules, decisions, what's done, what's next) at every session start, with no file that two people routinely edit at once.

### Cited Findings (basis for each element)
- A single cross-tool instruction file imported by CLAUDE.md, with no symlinks on Windows. — [Claude Code memory docs](https://code.claude.com/docs/en/memory); [agents.md](https://agents.md/)
- Up-front shared assumptions prevent conflicting implicit decisions (Flappy Bird), and writes should stay single-threaded. — [Cognition 2025](https://cognition.com/blog/dont-build-multi-agents); [Cognition 2026](https://cognition.com/blog/multi-agents-working)
- Progress file, JSON feature list with `passes`, git commits, start-of-session ritual, one feature at a time, clean state. — [Anthropic harness post](https://www.anthropic.com/engineering/effective-harnesses-for-long-running-agents)
- ADR status semantics (accepted = binding, superseded = history). — [Davidson](https://duncandavidson.com/agents-love-decisions)
- Hash/unique IDs to avoid merge collisions. — [Beads via Morph](https://www.morphllm.com/beads-agent-memory)
- SessionStart injection with the 10k-character cap; `compact` matcher re-runs after compaction. — [Claude Code hooks docs](https://code.claude.com/docs/en/hooks); [Claude Code context-window docs](https://code.claude.com/docs/en/context-window)
- Path-scoped rules, and skills with `disable-model-invocation`. — [Claude Code memory docs](https://code.claude.com/docs/en/memory); [Claude Code context-window docs](https://code.claude.com/docs/en/context-window)
- Size limits: under 200 lines (Anthropic), under 300 lines (HumanLayer). — [Claude Code memory docs](https://code.claude.com/docs/en/memory); [HumanLayer](https://www.humanlayer.dev/blog/writing-a-good-claude-md)

### Inferences (the concrete recommendation; all of this section is synthesis)

**File list, contents, who updates it, and when**

| Path | What goes in it | Who/what updates it | When |
|---|---|---|---|
| `AGENTS.md` (canonical, ≤ about 120 lines) | 1) One-paragraph product summary. 2) Event rules and product rules (moved from today's CLAUDE.md, kept at the top). 3) Repo map (`frontend/`, `backend/lambdas/`, `data/`, `infra/`, `docs/`) with one line each. 4) Commands: install, run, test, deploy (Amplify, Lambda), on Windows and POSIX. 5) Ownership map: Hemang = X, Girish = Y, Harshit = Z, "only the owner's agents write in that area; others open an issue or PR comment". 6) The **session protocol**: at start, read the SessionStart briefing, your status file and the relevant issue; at end, run `/handoff`. Team decisions go to `docs/decisions/`, never to auto memory. Never edit another person's status file. Never edit `docs/contracts.md` without a decision file. 7) Pointers: "read `docs/contracts.md` before touching an API, table, or S3 key"; "background research is in `docs/research/` (read only when asked)". | Humans only, via PR. One person (e.g. the integrator) merges AGENTS.md changes | Day 1 kickoff; then only when a rule changes |
| `CLAUDE.md` | Line 1 `@AGENTS.md`, then ≤ 10 Claude-only lines (e.g. "use `/handoff` before ending; `/decide` to record a decision"). | Humans | Rarely |
| `docs/contracts.md` (or `docs/contracts/{api,dynamodb,s3}.md`) | The frozen interfaces between the three areas: API routes and JSON request/response examples, DynamoDB table names/keys/GSIs, S3 bucket and key layout, env var names, shared naming and wording ("thermal anomaly", "candidate"). This is the anti-Flappy-Bird file. | Only the owning area's person (backend owner for API/tables; data owner for S3 layout), always paired with a decision file | Written in the first 2-3 hours, before parallel agents start; changes rare and announced |
| `docs/decisions/YYYYMMDD-HHMM-<initials>-<slug>.md` | Front matter: `status: accepted / proposed / superseded`, `superseded_by:`, `area:`, `date:`. Body ≤ about 20 lines: Context, Decision, Consequences, Alternatives rejected. | Any agent via `/decide`, reviewed by a human in the PR. Never edit someone else's file except to set `status: superseded` | Whenever a choice affects more than the current task (library, schema, prompt format, UX wording, cut scope) |
| `docs/status/{hemang,girish,harshit}.md` (≤ about 30 lines each, overwritten) | Fixed headers: **Now** (branch/worktree → task → issue #), **Done since last update**, **Next**, **Blocked / needs from others**, **Handoff notes** (gotchas, half-done state), **AI tools used** (feeds the writeup requirement). | That person's agents via `/handoff`; only the owner's agents write it | End of every agent session, or at least each time a PR is opened |
| GitHub Issues (one per feature/task, label = area, milestone = "Demo") | One-page mini spec in the body: goal, acceptance check (what must be visible in the video), files/areas touched, out of scope. Assignee = lock. PR says `Closes #n`. Agents use `gh issue view/comment`. | Humans create; agents comment progress and link PRs | Created at kickoff from the build plan; updated continuously |
| `docs/features.json` (optional, single-writer) | 10-15 demo-critical features: `{id, issue, area, description, demo_step, passes}`. Only `passes` changes. | Integrator only, after an end-to-end check on the deployed URL | At each integration on `main` |
| `.claude/settings.json` | `SessionStart` hook (matcher `startup|resume|clear|compact`) → `python .claude/hooks/brief.py`. Optional shared permissions. | Committed once | Day 1 |
| `.claude/hooks/brief.py` | Prints ≤ about 6k characters: branch and dirty state, last 15 commits on `origin/main`, the three status files' Now/Next/Blocked sections, the last 10 decision titles with status, contract file last-modified commit, open issues assigned to me (`gh`, 3-second timeout, skipped if unavailable). | Committed once | Day 1 |
| `.claude/skills/handoff/SKILL.md` (`disable-model-invocation: true`) | Steps: summarize the session; overwrite own `docs/status/<me>.md`; write any `/decide` files; comment on the issue; commit with a descriptive message. | Committed once | Run by the human before closing any agent session |
| `.claude/skills/decide/SKILL.md` | Template plus naming rule for decision files; supersede logic. | Committed once | On demand |
| `.claude/rules/{frontend,lambda,data}.md` with `paths:` (or nested `frontend/AGENTS.md` etc. for cross-tool) | Area conventions only (≤ about 60 lines each). | Area owner | Day 1, then as learned |
| `.gitattributes` | `docs/sessions/*.md merge=union` only if any shared append-only file is introduced; line-ending normalization (`* text=auto`) helps the Windows teammate. | Once | Day 1 |
| `CLAUDE.local.md` (gitignored) | Personal preferences only, never team facts. | Each person | Optional |

**Operating rules that make it work (low overhead)**
1. **Kickoff hour (all three together, one agent):** write `AGENTS.md`, `docs/contracts.md` and the first 5-8 decision files, and create the issues. Do this before anyone runs parallel agents. Cognition and the Flappy Bird example show conflicts come from undeclared assumptions.
2. **Parallel work:**
   - Each person runs 2-4 agents, each in its own git worktree and branch with exactly one issue.
   - Agents only write inside their owner's area.
   - Small PRs to `main` several times a day.
   - `git pull --rebase` before starting a new session, so the SessionStart briefing reflects teammates' latest decisions.
3. **Single writer per shared artifact:**
   - Contracts: the owning area.
   - `features.json` and AGENTS.md: the integrator.
   - Status files: their owner.
   - Decisions: new files only.
4. **Fresh-context reviewer:** before merging, a separate agent (or another tool such as Codex) reviews the PR diff against `AGENTS.md`, `contracts.md` and the accepted decisions, without the coder's history. This is Cognition 2026's generator-verifier pattern.
5. **Daily 10-minute sync (human):** skim new decision files, mark superseded ones, and trim the status files. This is the anti-poisoning step.

**Coherence vs overhead scorecard for 3 people / 3.5 days** (judgment, based on the cited sources)

| Mechanism | Preserves single-agent coherence | Overhead | Verdict |
|---|---|---|---|
| `AGENTS.md` + `@AGENTS.md` import in CLAUDE.md | High (same rules in every tool/session) | Very low | Adopt |
| `docs/contracts.md` frozen early | High (prevents conflicting implicit decisions) | Low (1-2 h up front) | Adopt |
| One-file-per-decision with status | High | Low (`/decide`) | Adopt |
| Per-person overwrite-only status files + `/handoff` | Medium-high | Low | Adopt |
| SessionStart briefing hook | High (rebuilds "what's going on" every start/compaction) | Low (one script) | Adopt |
| GitHub Issues as task board | Medium-high (cross-machine, atomic) | Low-medium (needs `gh` auth on each laptop) | Adopt once remote exists |
| JSON feature list (single writer) | Medium (anti-"declare victory") | Low | Optional |
| Path-scoped rules / nested AGENTS.md per area | Medium | Low | Adopt lightly |
| Fresh-context reviewer agent per PR | Medium-high (catches drift) | Low-medium (tokens) | Adopt for risky PRs |
| Full Spec Kit / Kiro spec workflow per feature | Medium | High for 3.5 days | Skip; use mini spec in the issue |
| Shared append-only PROGRESS.md / TODO.md | Medium | High (conflict hotspot) | Avoid (or `merge=union` + local rebase only) |
| Claude Code auto memory for team facts | Low across machines (machine-local) | None | Keep for personal prefs; route team facts to repo |
| Claude Code shared task list (`CLAUDE_CODE_TASK_LIST_ID`) | Medium within one laptop | Low | Optional per person; not cross-machine |
| Passing transcripts or `/export` files between people | Low-medium (huge, version-specific) | Medium | Avoid; share distilled handoffs |
| Beads (`bd`) | Medium-high | Medium (new tool, pre-1.0, install on Windows) | Skip for hackathon |
| MCP shared-memory server | Medium, but poisoning risk | High (hosting, auth, trust) | Skip |

**Event-specific benefit (inference):** timestamped decision files and per-person status files, all committed during 8-11 Oct by all three members, also support the "repo history must match the event dates" and "all three members should commit" rules. The "AI tools used" line in each status file feeds the required writeup list.

### Gaps
- The exact contents of `brief.py`, and its behavior on Windows (git and gh on PATH, Python launcher `py` vs `python`), need testing on the Windows laptop on day 1. The docs only confirm that exec-form commands must be real executables.
- The recommendation assumes each person uses Claude Code primarily. If someone runs mostly Kiro, Cursor or Codex, they get AGENTS.md but not the SessionStart hook or skills, so their agents should be told in AGENTS.md to read `docs/status/` and the latest `docs/decisions/` manually at start. Kiro steering `#[[file:...]]` or a Cursor `alwaysApply` rule could automate that; those tools' hook equivalents were not researched.
- Branching, worktree and merge strategy, and AWS shared-account resource isolation, are adjacent topics presumably covered by other researchers. They are only touched on here where they affect memory.
