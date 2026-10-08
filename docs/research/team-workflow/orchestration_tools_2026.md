# Tools for running and coordinating parallel AI coding agents (October 2026 landscape, for a 3-person hackathon team)

Research date: 2026-10-08. Primary sources are the live Claude Code docs at code.claude.com (fetched today, versions referenced up to v2.1.290), vendor sites, GitHub repos and changelogs. Most third-party "best orchestrator" roundups found are written by vendors of competing tools (Nimbalyst, Munder Difflin, Superset); this is flagged where used.

## 1. Claude Code's native multi-agent features: what exists, and which are single-user versus shareable across humans

### Takeaway
Claude Code now ships five built-in ways to parallelize (subagents, agent view/background agents, agent teams, dynamic workflows, Projects) plus worktree isolation and cross-session messaging, but every one of them is scoped to a single person's account or machine; the only coordination layers that several humans genuinely share are the git repo (CLAUDE.md/AGENTS.md, .claude/agents, skills, hooks, settings committed to it) and GitHub itself (PRs, issues, the Claude GitHub Action / @claude). Worktree isolation (desktop "worktree" toggle, `claude --worktree`, or `claude --bg` via agent view) is the mature, Windows-compatible way to avoid conflicts; agent teams are experimental and do not isolate teammates in worktrees.

### Cited Findings

**Overview of the parallel options (official)**
- Claude Code lists five ways to work on several tasks at once: subagents, agent view, agent teams, dynamic workflows, and projects; worktrees, cross-session messaging, and `/batch` support these without being a coordination style themselves. — [Run agents in parallel](https://code.claude.com/docs/en/agents)
- Maturity labels in the official comparison table: agent view is a "Research preview"; agent teams are "Experimental and disabled by default"; Projects are "Public beta on Pro and Max". — [Run agents in parallel](https://code.claude.com/docs/en/agents)
- Official selection guidance: "Do the tasks touch the same files? Isolate the work with worktrees... Agent teams don't isolate teammates in worktrees, so partition the work so each teammate owns a different set of files." — [Run agents in parallel](https://code.claude.com/docs/en/agents)
- `/batch` is a skill that "has Claude split one large change into 5 to 30 worktree-isolated subagents." — [Run agents in parallel](https://code.claude.com/docs/en/agents)
- "Running several sessions or subagents at once multiplies token usage." — [Run agents in parallel](https://code.claude.com/docs/en/agents)

**Subagents (custom agents in .claude/agents)**
- Subagents work inside one session, each in its own context window, and return a summary to the caller; Claude-named subagents can message each other. Lower token cost than agent teams. — [Agent teams (comparison table)](https://code.claude.com/docs/en/agent-teams)
- A custom subagent can be made to always run in its own git worktree by adding `isolation: worktree` to its frontmatter in `.claude/agents/`; the temporary worktree is removed automatically if the subagent made no changes. — [Worktrees](https://code.claude.com/docs/en/worktrees)
- Subagent worktrees branch from the repo's default branch unless `worktree.baseRef` is set to `"head"`. — [Worktrees](https://code.claude.com/docs/en/worktrees)
- Subagents defined in a repo's `.claude/agents/` are picked up automatically in cloud sessions too. — [Claude Code in the cloud](https://code.claude.com/docs/en/claude-code-on-the-web)
- Untracked `.claude/agents`, `.claude/skills`, `.claude/commands` in the main checkout are read through into worktrees that lack their own copy (skills read-through needs v2.1.277+). — [Worktrees](https://code.claude.com/docs/en/worktrees)

**Agent teams (teammates)**
- Experimental and disabled by default; enable with `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1` in settings.json or the environment. Known limitations around "session resumption, task coordination, and shutdown behavior." — [Agent teams](https://code.claude.com/docs/en/agent-teams)
- Architecture: a team lead (the main session), teammates (separate Claude Code instances), a shared task list, and a mailbox. Mailboxes are JSON files at `~/.claude/teams/{team-name}/inboxes/{agent-name}.json`; task list at `~/.claude/tasks/{team-name}/`; both are local to the machine and "never uploaded." — [Agent teams](https://code.claude.com/docs/en/agent-teams)
- Tasks have pending / in progress / completed states with dependencies; teammates self-claim the next unblocked task; "Task claiming uses file locking to prevent race conditions." — [Agent teams](https://code.claude.com/docs/en/agent-teams)
- Hooks for quality gates: `TeammateIdle`, `TaskCreated`, `TaskCompleted` (exit code 2 blocks and sends feedback). — [Agent teams](https://code.claude.com/docs/en/agent-teams)
- Teammates load CLAUDE.md, MCP servers and skills but "The lead's conversation history does not carry over." — [Agent teams](https://code.claude.com/docs/en/agent-teams)
- "Two teammates editing the same file leads to overwrites. Break the work so each teammate owns a different set of files." — [Agent teams](https://code.claude.com/docs/en/agent-teams)
- Limitations: no `/resume` or `/rewind` restore of in-process teammates; task status can lag and block dependents; "One team per session... You can't create additional named teams or share a team across sessions"; no nested teams; lead is fixed; "Split-pane mode isn't supported in VS Code's integrated terminal, Windows Terminal, or Ghostty" (default in-process mode works in any terminal). — [Agent teams](https://code.claude.com/docs/en/agent-teams)
- Spawning teammates requires an interactive session; with `claude -p` (headless) or the Agent SDK, Claude doesn't spawn teammates. — [Agent teams](https://code.claude.com/docs/en/agent-teams)
- Recommended size: "Start with 3-5 teammates for most workflows... Three focused teammates often outperform five scattered ones"; 5-6 tasks per teammate. — [Agent teams](https://code.claude.com/docs/en/agent-teams)
- Agent teams "use approximately 7x more tokens than standard sessions when teammates run in plan mode." — [Manage costs](https://code.claude.com/docs/en/costs)
- Agent teams can be enabled in cloud sessions via environment variables. — [Claude Code in the cloud](https://code.claude.com/docs/en/claude-code-on-the-web)

**Background agents / agent view**
- `claude agents` opens one terminal screen to dispatch and monitor many background sessions; `claude --bg "<prompt>"` starts a session straight in the background; `/background` (`/bg`) moves the current conversation to the background; `/fork` copies the conversation into a new background session (v2.1.212+). Research preview. — [Agent view](https://code.claude.com/docs/en/agent-view)
- "Before a dispatched session edits files, Claude moves it into an isolated git worktree under `.claude/worktrees/`" ("parallel sessions can read the same checkout but each writes to its own"). Claude is instructed to commit, push the branch, and open a draft PR when appropriate; it "never pushes to main or master, never force-pushes, and never merges." — [Agent view](https://code.claude.com/docs/en/agent-view)
- Sessions grouped as Pinned / Ready for review / Needs input / Working / Completed, with PR status labels (#1234 colored by checks/review/merged). — [Agent view](https://code.claude.com/docs/en/agent-view)
- Limits: "ten parallel agents use quota roughly ten times as fast as one"; sessions are local and stop if the machine shuts down; deleting a session can delete its worktree including uncommitted changes. — [Agent view](https://code.claude.com/docs/en/agent-view)
- Windows: the page includes Windows-specific troubleshooting (e.g., ending the supervisor with `taskkill /PID <pid>`), implying it runs on native Windows; it does not explicitly declare full Windows support. — [Agent view](https://code.claude.com/docs/en/agent-view)

**Worktree isolation**
- `claude --worktree <name>` (or `-w`) creates `.claude/worktrees/<name>/` on branch `worktree-<name>`; add `.claude/worktrees/` to `.gitignore`; requires at least one commit in the repo. — [Worktrees](https://code.claude.com/docs/en/worktrees); [Common workflows](https://code.claude.com/docs/en/common-workflows)
- `.worktreeinclude` (gitignore syntax) copies gitignored files such as `.env` into every new worktree, including desktop-app parallel sessions. — [Worktrees](https://code.claude.com/docs/en/worktrees)
- `worktree.baseRef`: `"fresh"` (default, branches from the remote default branch, fetching if >24h stale) or `"head"` (branch from local HEAD). `claude --worktree "#1234"` branches from a PR. — [Worktrees](https://code.claude.com/docs/en/worktrees)
- Isolation is enforced: edits to the main checkout, commands whose cwd is the main checkout, and git redirects into it are blocked; for PowerShell commands only the working-directory check applies. — [Worktrees](https://code.claude.com/docs/en/worktrees)
- Windows notes: worktree removal no longer follows NTFS junctions/directory symlinks (fixed v2.1.205); on Windows, "Yes, don't ask again" permission approvals made in a worktree stay with that worktree rather than the main checkout. — [Worktrees](https://code.claude.com/docs/en/worktrees)

**Desktop app (Code tab) parallel sessions**
- Windows x64 and ARM64 installers exist; each Code-tab session has its own history and folder; "+ New session" / Ctrl+N for parallel sessions; for Git repos, a **worktree** option next to the branch name gives the session an isolated worktree; Ctrl+click a sidebar session for a side-by-side split. — [Desktop](https://code.claude.com/docs/en/desktop)
- Environment choices: Local, Cloud, SSH, or a WSL distribution on Windows. — [Desktop](https://code.claude.com/docs/en/desktop)
- PR monitoring with CI auto-fix and "Auto-merge when ready" (squash) requires the GitHub CLI (`gh`) installed and authenticated, and auto-merge enabled in repo settings. — [Desktop](https://code.claude.com/docs/en/desktop)
- Session isolation requires Git. — [Desktop](https://code.claude.com/docs/en/desktop)

**Cross-session messaging**
- Claude can list and message "your other Claude Code sessions on this machine, on another machine, or in the cloud"; native Windows needs v2.1.234+. Messages are plain text, not history or files. — [Cross-session messaging](https://code.claude.com/docs/en/cross-session-messaging)
- Same-machine messages travel over a per-session socket (named pipe on native Windows); other-machine and cloud sessions are reached through Anthropic servers via Remote Control, which "needs a claude.ai sign-in." The doc consistently scopes this to "your" sessions; on a shared machine "another user's sessions can't deliver to it." A WSL 2 session and a native Windows session on the same computer can't reach each other. — [Cross-session messaging](https://code.claude.com/docs/en/cross-session-messaging)

**Projects (threads)**
- A project is one ongoing conversation at claude.ai/code or in the desktop app where Claude starts parallel threads (usually cloud sessions) sharing repos, project instructions (up to 16,000 chars) and project memory. — [Projects](https://code.claude.com/docs/en/claude-projects)
- "Projects are in public beta on Pro and Max plans and rolling out gradually... They aren't available on Team or Enterprise plans yet"; waitlist if not visible. — [Projects](https://code.claude.com/docs/en/claude-projects)
- "A project belongs to one user. You can't share a project or its threads with another user." Enforced limit: 200 new threads per day. — [Projects](https://code.claude.com/docs/en/claude-projects)

**Claude Code in the cloud (web) and teleport**
- Cloud sessions are available on Pro, Max, Team, and Enterprise (premium or Chat + Claude Code seats); run in isolated Anthropic VMs; `claude --cloud "<task>"` starts one from the terminal (clones the GitHub remote at the current branch, so push first); multiple `--cloud` commands run in parallel; `claude --teleport` pulls a cloud session and its branch back into the terminal (one-way from CLI). `--remote` is a deprecated alias for `--cloud`. — [Claude Code in the cloud](https://code.claude.com/docs/en/claude-code-on-the-web)
- Sharing: Team/Enterprise accounts can set Team visibility; Pro/Max accounts can only choose Private or Public (any logged-in claude.ai user); recipients see the latest state but "their view doesn't update in real time." — [Claude Code in the cloud](https://code.claude.com/docs/en/claude-code-on-the-web)
- "Cloud sessions share rate limits with all other Claude and Claude Code usage within your account... There is no separate compute charge for the cloud VM." — [Claude Code in the cloud](https://code.claude.com/docs/en/claude-code-on-the-web)
- Auto-fix PRs: Claude watches a PR, responds to CI failures and review comments, and pushes fixes; requires the Claude GitHub App; it cannot react to merge conflicts on its own ("GitHub does not emit a webhook when the base branch advances"). `/autofix-pr` from the terminal starts it. — [Claude Code in the cloud](https://code.claude.com/docs/en/claude-code-on-the-web)
- Windows caution: on native Windows, `--cloud` bundle uploads include uncommitted changes to tracked files "whatever the file's name" (macOS/Linux/WSL exclude credential-like files such as `.env`). — [Claude Code in the cloud](https://code.claude.com/docs/en/claude-code-on-the-web)

**Headless mode, GitHub Action, @claude**
- `claude -p` runs non-interactively for scripts/CI; `-p --worktree` skips the trust check; `-p` worktrees are not auto-cleaned. — [Common workflows](https://code.claude.com/docs/en/common-workflows); [Worktrees](https://code.claude.com/docs/en/worktrees)
- The Claude Code GitHub Action is `anthropics/claude-code-action@v1` (migrate from `@beta`); quick setup via `/install-github-app` (needs repo admin and `gh`); responds to `@claude` in issue/PR comments, reviews, or new issue bodies; can turn issues into PRs. — [GitHub Actions](https://code.claude.com/docs/en/github-actions)
- Auth: `ANTHROPIC_API_KEY` or `CLAUDE_CODE_OAUTH_TOKEN` (generated with `claude setup-token`, works on Pro, Max, Team, Enterprise; "tied to the subscription of the person who ran `claude setup-token`"). Costs = GitHub Actions minutes + tokens (or the subscription when using the OAuth token). Only users with write access can trigger runs. — [GitHub Actions](https://code.claude.com/docs/en/github-actions)
- A separate "Code Review" product does automated multi-agent PR reviews without a workflow file; `/code-review` runs a local review in the desktop app. — [Docs index](https://code.claude.com/docs/llms.txt); [Desktop](https://code.claude.com/docs/en/desktop)
- Routines run cloud sessions on a schedule, on API calls, or on GitHub events (claude.ai/code/routines). — [Common workflows](https://code.claude.com/docs/en/common-workflows)

**Shared context: CLAUDE.md, AGENTS.md, auto memory**
- Project `./CLAUDE.md` (or `./.claude/CLAUDE.md`) is "Team-shared instructions for the project... via source control"; `CLAUDE.local.md` is personal and gitignored, and only exists in the worktree where it was created. — [Memory](https://code.claude.com/docs/en/memory)
- Claude Code reads `AGENTS.md` natively (v2.1.277+) when there is no CLAUDE.md; if both exist it reads only CLAUDE.md unless CLAUDE.md imports AGENTS.md or the "Project instructions" setting is `claude-md-and-agents-md`. — [Memory](https://code.claude.com/docs/en/memory)
- Auto memory lives at `~/.claude/projects/<project>/memory/` (MEMORY.md index); "Auto memory is machine-local. All worktrees and subdirectories within the same git repository share one auto memory directory. Files are not shared across machines or cloud environments." Main-conversation auto memory is not loaded into subagents (except forks). — [Memory](https://code.claude.com/docs/en/memory)
- Docs advise keeping CLAUDE.md under ~200 lines and moving specialised workflows into skills (loaded on demand). — [Manage costs](https://code.claude.com/docs/en/costs)

**Plugins, skills, hooks**
- Project-scope plugins installed from the main checkout also load in worktrees (v2.1.200+). — [Worktrees](https://code.claude.com/docs/en/worktrees)
- PreToolUse hooks can block actions regardless of what Claude decides ("To block an action regardless of what Claude decides, use a PreToolUse hook"). — [Memory](https://code.claude.com/docs/en/memory)
- Hook `${CLAUDE_PROJECT_DIR}` stays at the main checkout after entering a worktree; the hook input `cwd` follows the worktree. — [Worktrees](https://code.claude.com/docs/en/worktrees)

**Windows specifics for Claude Code CLI**
- Native Windows 10 1809+ is supported; Git for Windows is optional but provides Git Bash for the Bash and Monitor tools; without it Claude Code uses the PowerShell tool. Sandboxing is not supported on native Windows (supported on WSL 2). — [Setup](https://code.claude.com/docs/en/setup)

### Inferences
- Single-user only: subagents, agent teams (local JSON mailbox/task files, one team per session), agent view/background sessions (local supervisor), cross-session messaging (scoped to your own account's sessions), Projects (explicitly one user), auto memory (machine-local). None of these can serve as a three-person coordination layer.
- Shareable across the three humans: anything committed to the repo (CLAUDE.md/AGENTS.md, `.claude/agents/*.md`, `.claude/skills`, `.claude/settings.json` hooks and permission allowlists, `.worktreeinclude`), plus GitHub-native surfaces (PRs, issues, `@claude` via the Action, which anyone with write access can trigger). Cloud session links can be shared read-only (Public on Pro/Max), which is a weak hand-off mechanism rather than coordination.
- The "decision memory" of a single agent session does not propagate between teammates automatically, because auto memory is machine-local and conversation history is not shared; the team needs a committed decisions/progress file that every agent reads (referenced from CLAUDE.md) to approximate shared memory.
- For a Windows teammate, the most reliable conflict-avoidance path is the desktop Code tab's worktree toggle or `claude --worktree` / `claude --bg`; agent teams' split-pane mode will not work in Windows Terminal, and agent teams provide no worktree isolation, so they are a poor fit for parallel implementation on one codebase.

### Gaps
- No official statement on how many concurrent desktop Code-tab sessions are practical on Windows (memory/CPU), or explicit "Windows supported" wording on the agent view page.
- Did not fetch the hooks reference, plugins, dynamic workflows, routines or Code Review pricing pages in detail.
- Did not verify the Claude Code GitHub repo release notes directly; version numbers above come from the docs' inline version notes.

## 2. Third-party orchestrators (Conductor, Vibe Kanban, claude-squad, Crystal, Sculptor, Claude Flow, Superset, uzi, Terragon, others)

### Takeaway
Most third-party orchestrators are worktree managers with a review UI, and most are macOS-first: Conductor is Mac-only, claude-squad and uzi depend on tmux, Sculptor is macOS/Linux, Vibe Kanban is sunsetting, and Crystal was deprecated in favour of Nimbalyst. The cross-platform options that claim native Windows support are Nimbalyst, Emdash, Orca and Munder Difflin, but those claims come mainly from competing vendors' comparison pages. Given that Claude Code itself now ships worktree isolation, agent view and a desktop UI with split panes and PR monitoring, a 3.5-day team gains little from adopting a third-party orchestrator.

### Cited Findings

**Conductor (conductor.build)**
- Runs parallel coding agents "on your Mac" in isolated workspaces with review and merge; lists Claude Code, Codex and Cursor; changelog shows version 0.90.0; only macOS is mentioned on the site. — [conductor.build](https://www.conductor.build/)
- Listed as macOS only, "Free for now. Paid collaboration features planned." — [Nimbalyst roundup (vendor-authored, updated July 29, 2026)](https://nimbalyst.com/blog/best-agent-management-tools-2026/)
- Conflicting: another vendor roundup says Conductor has a free plan for local workspaces, paid plans for cloud workspaces, and a Teams plan with "live collaboration on shared workspaces," and that it "moved into the cloud." — [Munder Difflin blog (vendor-authored, checked Sept 10, 2026)](https://munderdiffl.in/blog/best-claude-code-multi-agent-tools/)

**Vibe Kanban (vibekanban.com, Bloop)**
- Kanban board to plan, prompt and review agent work; creates git worktrees, runs setup scripts, starts dev servers; supports Claude Code, Codex, OpenCode, Gemini, Cursor, Amp, Aider, Copilot, Windsurf; describes team issue tracking. Site says "Vibe Kanban is sunsetting" and "will continue as open source and community maintained." — [vibekanban.com](https://www.vibekanban.com/)
- Apache-2.0; company shut down April 10, 2026; paid cloud plans ended; continues as community open source. — [Nimbalyst roundup](https://nimbalyst.com/blog/best-agent-management-tools-2026/)
- Runs via `npx vibe-kanban`. — [Munder Difflin blog](https://munderdiffl.in/blog/best-claude-code-multi-agent-tools/)

**claude-squad (smtg-ai/claude-squad)**
- Terminal app (`cs`) managing multiple agents (Claude Code default, Codex, Gemini, Aider, OpenCode, Amp), each in its own tmux session and git worktree; depends on tmux and gh; installed via Homebrew or a curl shell script; AGPL-3.0; ~8.6k stars; `-y/--autoyes` flag experimental. No Windows/WSL statement on the page. — [GitHub: smtg-ai/claude-squad](https://github.com/smtg-ai/claude-squad)

**Crystal -> Nimbalyst**
- Crystal README: "has been deprecated and replaced by Nimbalyst," dated "Deprecated: February 2026"; MIT; ~3.1k stars. — [GitHub: stravu/crystal](https://github.com/stravu/crystal)
- Nimbalyst: visual workspace with kanban, workstreams, editors and diff review; runs Claude Code and Codex (OpenCode and Copilot in alpha); macOS, Windows, Linux, iOS; free for individuals, Teams $20/user/month (free during beta); MIT desktop app. (Vendor's own product.) — [Nimbalyst roundup](https://nimbalyst.com/blog/best-agent-management-tools-2026/)

**Sculptor (Imbue)**
- Runs each agent in its own Docker container, with "Pairing Mode" to pull changes into the local environment; macOS (Apple Silicon) and Linux; free for testers; early research preview. — [Nimbalyst roundup](https://nimbalyst.com/blog/best-agent-management-tools-2026/)

**Claude Flow -> Ruflo**
- Ruflo is the current name of Claude Flow; a multi-agent orchestration/execution layer that wraps Claude Code or Codex. — [ScrapingBee: Ruflo](https://scrapingbee.com/blog/ruflo-ai-agent-orchestration); [Daniel Vaughan, Apr 9, 2026](https://codex.danielvaughan.com/2026/04/09/claude-multi-agent-ecosystem/)
- The npm package `claude-flow` has a Snyk security listing (contents not reviewed). — [Snyk: claude-flow](https://security.snyk.io/package/npm/claude-flow)

**Superset (superset.sh, YC P26)**
- Desktop IDE, CLI and MCP server built on git worktrees, with terminal management, diff review, automations and remote hosts; macOS desktop, Linux CLI beta; Free for 1 user, Pro $15/user/month billed yearly. — [Nimbalyst roundup](https://nimbalyst.com/blog/best-agent-management-tools-2026/)
- Conflicting Windows status on Superset's own site: docs say "macOS (Apple Silicon or Intel) — Windows and Linux coming soon," while a comparison page claims macOS, Windows and Linux; another page describes it as source-available under Elastic License 2.0. — [Superset docs](https://docs.superset.sh/); [Superset vs Emdash](https://superset.sh/compare/superset-vs-emdash)

**uzi (devflowinc)**
- CLI for running many coding agents in parallel, each isolated with git worktrees and tmux. One aggregator reported the last push about 11 months before indexing (snapshot date unclear). A winget package listing exists. — [uzi docs (Mintlify)](https://www.mintlify.com/devflowinc/uzi/introduction); [gittrend](https://gittrend.io/repo/devflowinc/uzi); [winstall: Devflow.Uzi](https://winstall.app/apps/Devflow.Uzi)

**Terragon**
- Described as running Claude Code agents in parallel in cloud VMs that open GitHub PRs, "free while in public beta" (undated post). — [The Tool Nerd](https://www.thetoolnerd.com/p/era-of-virtual-employees-running)

**Others with claimed Windows support**
- Emdash (YC W26, Apache-2.0): worktree per task, 30+ auto-detected agent CLIs, diff review with push-and-create-PR, issue-tracker integrations; listed as running on macOS, Windows and Linux. — [Superset vs Emdash (competitor-authored)](https://superset.sh/compare/superset-vs-emdash); [Munder Difflin blog](https://munderdiffl.in/blog/best-claude-code-multi-agent-tools/)
- Orca: MIT, ~39,000 stars, parallel worktrees on macOS, Windows and Linux with mobile companions; no scheduler. — [Superset: Orca alternative (competitor-authored)](https://superset.sh/compare/orca-alternative)
- Munder Difflin: macOS, Windows, Linux; MIT; optional Pro/Teams plans where "your clone works with teammates' clones." (Vendor's own product.) — [Munder Difflin blog](https://munderdiffl.in/blog/best-claude-code-multi-agent-tools/)
- Opcode (formerly Claudia) is "no longer actively developed"; Mux (Coder) is macOS/Linux/browser, AGPL-3.0. — [Nimbalyst roundup](https://nimbalyst.com/blog/best-agent-management-tools-2026/)

### Inferences
- Summary table (from the findings above; Windows column reflects available evidence, not hands-on testing):

| Tool | Core function | Native Windows | Multi-user | 2026 status | Cost |
|---|---|---|---|---|---|
| Conductor | Mac app, worktree per agent, diff/PR UI | No (macOS only) | Teams/collab: conflicting reports | Active (v0.90.0) | Free local; paid tiers conflicting |
| Vibe Kanban | Kanban + worktrees + review | Unconfirmed | Team issue tracking (hosted part shut down) | Sunsetting, community OSS | Free (Apache-2.0) |
| claude-squad | tmux TUI + worktrees | No (tmux; WSL untested) | No | Active repo, 8.6k stars | Free (AGPL-3.0) |
| Crystal | Desktop worktree manager | n/a | n/a | Deprecated Feb 2026 | Free (MIT) |
| Nimbalyst | Visual workspace, kanban, diff review | Yes (vendor claim) | Teams tier | Active | Free / $20 user/mo Teams |
| Sculptor | Docker container per agent | No (macOS AS, Linux) | No | Research preview | Free for testers |
| Ruflo (Claude Flow) | Swarm orchestration wrapper | Unverified | Unverified | Active (renamed) | OSS |
| Superset | Worktree IDE/CLI/MCP | Conflicting | Pro per-user tier | Active (YC P26) | Free 1 user, $15/user/mo |
| uzi | CLI, worktrees + tmux | Unclear (tmux; winget listing) | No | Possibly stale | Free |
| Terragon | Cloud parallel Claude Code to PRs | Browser-based | Unverified | Unknown | Free beta (undated) |
| Emdash | Worktree per task, 30+ agents, issue trackers | Yes (competitor claim) | Issue-tracker integrations | Active (YC W26) | Free (Apache-2.0) |
| Orca | Parallel worktrees | Yes (competitor claim) | Unverified | Active, ~39k stars | Free (MIT) |

- For a mixed Windows/Mac team over 3.5 days, adopting any of these adds install/learning risk for marginal gain over Claude Code's built-in desktop worktree sessions and agent view. If one is wanted for its board UI, Emdash or Nimbalyst are the only ones with multi-source claims of Windows support, but they would need a quick hands-on check first.

### Gaps
- No primary-source confirmation of Windows builds for Emdash, Orca, Vibe Kanban, Ruflo or Superset (only vendor/competitor pages).
- Terragon's current (October 2026) status and pricing not found; no shutdown report found either.
- Did not find Hacker News threads or neutral practitioner benchmarks comparing these tools in 2026.
- Conductor's pricing and team features conflict between two vendor-authored sources; Conductor's own pricing page was not fetched.

## 3. Other vendors' parallel-agent offerings, shared context and conflict handling

### Takeaway
Every major vendor now runs parallel agents in isolated worktrees or cloud sandboxes and converges on AGENTS.md (or its own steering files) for shared context: GitHub Copilot coding agent reads AGENTS.md and CLAUDE.md and works issue-to-PR in sandboxed Actions runners; OpenAI Codex has a Windows desktop app with worktree-per-task plus cloud tasks; Cursor 3 has an Agents Window with worktrees and a September 2026 "Projects" coordinator; Kiro reads AGENTS.md and steering files, offers parallel subagents, and has replaced Amazon Q Developer (new Q sign-ups closed May 15, 2026); Jules and Devin offer cloud concurrency with per-person caps. All of them handle conflicts the same way, through isolation plus PR review, not through semantic merge.

### Cited Findings

**GitHub Copilot coding agent / Agent HQ / mission control**
- Agent HQ (announced Universe, Oct 2025) aims to be a vendor-neutral hub; mission control is its first component for assigning, steering and tracking agent work across GitHub, VS Code and mobile. — [GitHub blog: Introducing Agent HQ](https://github.blog/news-insights/company-news/welcome-home-agents/)
- Went live February 4, 2026 with Claude and Codex agents alongside Copilot, initially for Copilot Pro+ and Enterprise. — [TestingCatalog](https://www.testingcatalog.com/github-lets-copilot-subscribers-run-multiple-ai-coding-agents/)
- Copilot coding agent supports AGENTS.md (root or nested), and still reads `.github/copilot-instructions.md`, `.github/instructions/**.instructions.md`, CLAUDE.md and GEMINI.md (Aug 28, 2025). — [GitHub changelog](https://github.blog/changelog/2025-08-28-copilot-coding-agent-now-supports-agents-md-custom-instructions)
- Billing changed June 1, 2026 from premium requests to usage-based AI Credits (1 credit = $0.01); Pro $10/month with $10 credits, Pro+ $39/month with $39 credits; coding-agent tasks draw from credits; completions remain free. (Third-party; verify on GitHub pricing.) — [aicodereview.cc](https://aicodereview.cc/blog/github-copilot-pricing); [Daniel Vaughan, June 1, 2026](https://codex.danielvaughan.com/2026/06/01/june-2026-coding-agent-billing-reset-openai-github-anthropic-google-pricing-changes-codex-cli-budget/)
- Legacy premium-request billing applies only to annual Pro/Pro+ subscribers who stayed on old billing after June 1, 2026. — [GitHub Docs: legacy requests](https://docs.github.com/en/copilot/reference/copilot-billing/request-based-billing-legacy/copilot-requests)

**OpenAI Codex**
- Codex cloud: tasks run from a published cloud environment; "Each task has its own workspace and can keep working while your computer is asleep"; environments configure repos, secrets, network ("Allow Codex to access internet" option), install scripts; commit or open a PR after review. — [Codex cloud docs](https://learn.chatgpt.com/docs/cloud)
- Codex desktop app launched on macOS (around Feb 2, 2026) and later on Windows; the Windows app runs multiple tasks in parallel, "each task runs in its own worktree," with diff review and comments. — [Heise](https://heise.de/-11165126); [Neowin](https://www.neowin.net/news/openai-releases-the-much-awaited-codex-app-for-windows/)
- Codex CLI on Windows: native PowerShell with a native sandbox (reported as promoted from experimental around v0.100.0), or WSL2; sources conflict on sandbox maturity. — [itecsonline guide](https://itecsonline.com/post/how-to-install-codex-cli-on-windows-2026-guide)
- Codex reads AGENTS.md with a default 32 KiB cap (`project_doc_max_bytes`), content beyond it reportedly truncated silently. — [Neura Market Codex guide](https://neura.market/ai-agents/resources/guides/codex-guide)

**Cursor**
- Cursor 3 (April 2, 2026) introduced an agent-centred interface. — [DataCamp: Cursor 3](https://www.datacamp.com/zh/blog/cursor-3)
- The Agents Window natively supports git worktrees so background tasks run on separate branches and can be brought local in one click. — [Cursor forum](https://forum.cursor.com/t/worktrees-in-agents-window/158956/3)
- Multi-agent support began with Cursor 2.0 (Oct 2025), up to eight agents at once, each in its own worktree. — [dsebastien notes](https://notes.dsebastien.net/30+Areas/33+Permanent+notes/33.02+Content/Cursor+Multi-Agents)
- Official changelog: Sep 10, 2026 "Cursor Projects (beta)" with a coordinator agent that delegates to subagents and maintains shared context files synced across machines; Sep 2 self-hosted machines with team pools; Sep 23 Rollouts and Security Review bots (Teams/Enterprise); Oct 6, 2026 Remote Control for local agents from iOS. — [Cursor changelog](https://cursor.com/changelog)

**Kiro (AWS)**
- IDE chat subagents: built-in context-gathering and general-purpose subagents with separate context windows; the main agent waits for all subagents; steering and MCP carry into subagents, but subagents have no Specs access and hooks don't fire inside them; custom agents in `.kiro/agents/`. — [Kiro docs: subagents](https://kiro.dev/docs/chat/subagents/); [Kiro CLI subagents](https://kiro.dev/docs/cli/chat/subagents)
- A separate "Crew" product describes short-lived background subagents running in parallel with a `kirocrew` CLI. — [Kiro Crew subagents](https://kiro.dev/docs/crew/features/subagents/)
- Steering: workspace files in `.kiro/steering/`, global in `~/.kiro/steering/`; inclusion modes always / fileMatch / manual / auto; "Kiro supports the AGENTS.md standard" (always included, discovered in subdirectories); steering "is part of your codebase." — [Kiro docs: steering](https://kiro.dev/docs/steering/)
- Specs generate requirements, design and task-list Markdown files before code; hooks fire on save/commit; spec, task and hook executions consume credits. — [Morph: Kiro pricing](https://www.morphllm.com/kiro-pricing); [usagebar: Kiro pricing](https://usagebar.com/blog/kiro-pricing-and-free-tier)
- Pricing (mid-2026 third-party): Free 50 credits/month; Pro $20 (1,000 credits); Pro+ $40 (2,000); Pro Max $100 (5,000); Power $200 (10,000); new accounts get a 500-credit bonus valid 14 days; overage $0.04/credit. — [Morph: Kiro pricing](https://www.morphllm.com/kiro-pricing); [usagebar](https://usagebar.com/blog/kiro-pricing-and-free-tier)
- Runs on Windows 10/11, macOS and Linux (Code OSS based). — [Windows Mode guide](https://www.windowsmode.com/kiro-ide-on-windows/amp/)

**Amazon Q Developer**
- New Q Developer Free Tier and Pro sign-ups ended May 15, 2026; newest models (e.g., Opus 4.7) exclusive to Kiro; IDE plugins and paid subscriptions reach end of support April 30, 2027; console/Slack/Teams Q features continue. — [Daniel Vaughan, May 5, 2026](https://codex.danielvaughan.com/2026/05/05/amazon-q-developer-sunset-codex-cli-aws-migration-kiro-bedrock/); [Let's Data Science](https://letsdatascience.com/news/amazon-q-developer-announces-end-of-support-timeline-97a57c03)

**Google Jules**
- Official limits: Free 15 tasks/day and 3 concurrent; Pro (Google AI Pro) 100/day and 15 concurrent; Ultra 300/day and 60 concurrent; rolling 24h window; limits are per person, not pooled. — [Jules usage limits](https://jules.google/docs/usage-limits/)
- Google AI Pro about $19.99/month; Ultra about $249.99/month (third-party; conflicting promo pricing). — [StackPick](https://stackpick.net/pricing/jules/)

**Devin (Cognition)**
- Mid-2026 self-serve tiers (third-party, conflicting): Pro $20/month and Max $200/month with up to 10 concurrent sessions; Teams $80/month minimum plus $40/seat; Enterprise on ACUs. — [usagebar: Devin pricing](https://usagebar.com/blog/devin-pricing-and-rate-limits); [Omid Saffari](https://omidsaffari.com/blog/devin-pricing)

### Inferences
- AGENTS.md is the de facto cross-tool context file in 2026: Claude Code (native read since v2.1.277 or via import), Copilot coding agent, Kiro and Codex all read it. A team mixing Claude Code with Kiro or Copilot should keep one AGENTS.md as the single source of truth and have CLAUDE.md import it (`@AGENTS.md`) or rely on the `claude-md-and-agents-md` setting.
- None of these tools resolve semantic conflicts between agents; they avoid textual conflicts through isolation (worktree, container or cloud VM) and push resolution to PR review and CI. File/module ownership per person remains the team's real conflict-avoidance mechanism.
- Kiro is the sponsor's IDE and has relevant features (specs as committed Markdown, steering, AGENTS.md, hooks), but its credit metering (50 free credits/month; 500 bonus for 14 days) means heavy parallel use requires a paid tier; it is better suited as a spec/design generator than as the team's main parallel-execution engine.
- GitHub Agent HQ / Copilot Pro+ would give a GitHub-native shared board for assigning issues to Claude, Codex or Copilot, but it requires paid Copilot tiers and its October 2026 scope is unverified, so it is risky to rely on for a 3.5-day event.

### Gaps
- No official confirmation of Codex "best-of-N / multiple attempts" in the current cloud docs (the fetched page does not mention it), nor of Codex plan pricing.
- Agent HQ's status after spring 2026 (GA, which agents, which tiers) was not found in primary sources.
- Kiro's "autonomous agent" page content and any team/multi-user features were not retrieved; Kiro pricing figures are third-party.
- Cursor official pricing for cloud/background agents and Cursor Projects not checked.
- Devin and Jules figures largely third-party; Jules limits are official but undated.

## 4. Coordination layers a team can share, and which can be set up in under an hour

### Takeaway
The fastest shared coordination layer is GitHub itself: a GitHub Issues list (optionally a Projects board) that every human and agent reads and writes through the `gh` CLI, PRs with CI as the merge gate, and committed repo files (AGENTS.md/CLAUDE.md, a decisions log, a task/ownership file). Claude Code's docs explicitly prefer CLI tools like `gh` over MCP servers for context efficiency, and Claude Code's PR features (agent view PR labels, desktop PR monitoring/auto-merge, `@claude` Action) already depend on `gh` and GitHub. MCP-based shared memory or Linear adds setup and auth risk with little benefit for three people.

### Cited Findings
- "Prefer CLI tools when available: Tools like `gh`, `aws`, `gcloud`, and `sentry-cli` are still more context-efficient than MCP servers because they don't add any per-tool listing." — [Manage costs](https://code.claude.com/docs/en/costs)
- MCP tool definitions are deferred by default (only names enter context until used); `/mcp` disables unused servers. — [Manage costs](https://code.claude.com/docs/en/costs)
- Desktop PR monitoring and auto-merge require `gh` installed and authenticated. — [Desktop](https://code.claude.com/docs/en/desktop)
- Agent view shows each session's PR number and status (checks/review/merged); `claude --from-pr <n>` finds sessions linked to a PR; sessions created via `gh pr create` are linked automatically. — [Agent view](https://code.claude.com/docs/en/agent-view); [Common workflows](https://code.claude.com/docs/en/common-workflows)
- `@claude` in issues/PRs triggers the GitHub Action for anyone with write access, so the issue tracker doubles as a shared dispatch surface. — [GitHub Actions](https://code.claude.com/docs/en/github-actions)
- Committed `CLAUDE.md` is shared "via source control"; auto memory is machine-local and not shared across machines. — [Memory](https://code.claude.com/docs/en/memory)
- Cross-session messaging lets your sessions tell each other "what landed" across worktrees, but only among one account's sessions. — [Cross-session messaging](https://code.claude.com/docs/en/cross-session-messaging)
- GitHub's hosted MCP server can be added with `claude mcp add --transport http github https://api.githubcopilot.com/mcp/`, includes a Projects toolset and 50+ tools that consume context; one guide says hosted access depends on a Copilot seat, with a local Docker + PAT fallback (third-party, unverified). — [Builder.io: Claude Code MCP servers](https://www.builder.io/blog/claude-code-mcp-servers); [hustletoai setup guide](https://www.hustletoai.com/blog/ai-coding-6/github-mcp-server-claude-code-setup-guide-2026-80)
- Linear MCP integrations can create tickets and change statuses; one roundup describes occasional OAuth token expiry. — [evomap: best MCP servers 2026](https://evomap.ai/es/blog/best-mcp-servers-for-claude-code-2026)
- Agent teams' shared task list is local files under `~/.claude/tasks/` on the lead's machine, so it cannot be shared across three laptops. — [Agent teams](https://code.claude.com/docs/en/agent-teams)
- Cursor's new Projects maintains "shared context files that sync across machines" (Cursor-only). — [Cursor changelog](https://cursor.com/changelog)

### Inferences
- Under-one-hour setup ranking for this team: (1) GitHub Issues + `gh` CLI + a labels convention (owner:hemang / girish / harshit, status labels) - minutes; (2) committed `AGENTS.md` + `CLAUDE.md` importing it + `docs/decisions.md` + `docs/progress.md` - 15-30 minutes; (3) branch protection + a CI check + PR template - 15-30 minutes; (4) Claude GitHub Action via `/install-github-app` - roughly 10-20 minutes, needs repo admin and a secret; (5) GitHub Projects board - optional, ~15 minutes; (6) GitHub MCP / Linear MCP - possible, but adds auth/context overhead and is not needed when `gh` works.
- A "shared memory MCP server" is unnecessary: a committed decisions log plus CLAUDE.md is version-controlled, visible in PR diffs, readable by Kiro/Copilot/Codex too, and survives across all three machines.
- Rule of thumb for conflict avoidance: one issue = one branch = one worktree = one PR; assign directory ownership per person; require rebase on `main` before merge; keep shared contract files (API schemas, DB schema, types) owned by one person and changed in small dedicated PRs.

### Gaps
- Did not verify the official GitHub MCP server documentation (whether a Copilot seat is required) or Linear's official hosted MCP endpoint and auth flow.
- No hands-on timing data; the setup-time estimates above are inferences.

## 5. Cost and rate limits for many parallel agents; realistic concurrency per person

### Takeaway
Every parallel Claude agent (background session, subagent, teammate, cloud session) draws from the same per-account allowance, and usage scales roughly linearly with the number of active agents (ten agents use quota about ten times as fast; agent teams use about 7x the tokens in plan mode). Subscription plans have a rolling five-hour window plus a weekly cap shared with claude.ai chat. For a 3.5-day sprint, Max (5x or 20x) per person is the comfortable tier for 3-4 concurrent agents; on Pro, 1-2 concurrent agents on Sonnet is the realistic ceiling. In practice, human review and integration usually become the bottleneck at about 2-4 active agents per person, which matches Anthropic's own "start with 3-5" teammate guidance.

### Cited Findings
- Background sessions "use your subscription usage the same way interactive sessions do, so ten parallel agents use quota roughly ten times as fast as one." — [Agent view](https://code.claude.com/docs/en/agent-view)
- Agent teams: "Token costs scale linearly"; "approximately 7x more tokens than standard sessions when teammates run in plan mode"; use Sonnet for teammates and shut them down when done. — [Agent teams](https://code.claude.com/docs/en/agent-teams); [Manage costs](https://code.claude.com/docs/en/costs)
- Cloud sessions "share rate limits with all other Claude and Claude Code usage within your account"; no separate VM compute charge. — [Claude Code in the cloud](https://code.claude.com/docs/en/claude-code-on-the-web)
- Projects use plan limits "faster than a single session does, and on a Pro plan in particular you should expect to reach your limit sooner"; a thread that hits the limit waits and resumes at reset; 200 new threads/day cap. — [Projects](https://code.claude.com/docs/en/claude-projects)
- Enterprise averages: about $13 per developer per active day, $150-250 per developer per month, below $30/active day for 90% of users. — [Manage costs](https://code.claude.com/docs/en/costs)
- Team/Enterprise: per-seat allowance on a rolling five-hour window and a weekly window, shared with Claude chat and Cowork; size depends on Standard vs Premium seat; usage credits can extend past the allowance. — [Manage costs](https://code.claude.com/docs/en/costs)
- Limit messages: "You've hit your session limit" / "weekly limit" are seat-wide across models; model-specific Opus/Sonnet limits can be sidestepped by switching model family; v2.1.234+ can wait and auto-continue after reset. — [Manage costs](https://code.claude.com/docs/en/costs)
- Subscription prompt-cache lifetime is one hour, dropping to five minutes once drawing on usage credits (and five minutes by default on API keys), so idle-then-resume sessions re-read full context. — [Manage costs](https://code.claude.com/docs/en/costs)
- API (Console) recommended rate limits for 1-5 users: 200k-300k TPM and 5-7 RPM per user. — [Manage costs](https://code.claude.com/docs/en/costs)
- Third-party pricing (mid-2026): Pro about $20/month, Max 5x $100/month, Max 20x $200/month; Team requires minimum 5 seats, Standard about $25/seat/month and Premium about $125/seat/month (some sources conflict on whether Standard seats include full Claude Code). — [heyuan110: Claude pricing 2026](https://www.heyuan110.com/posts/ai/2026-02-25-claude-code-pricing/); [Zenken: Team plan deep dive](https://ai.zenken.co.jp/en/post/claude-team-plan-deep-dive/)
- Third-party descriptions of subscription limits: a rolling five-hour allowance plus a weekly cap; all surfaces (claude.ai and Claude Code) draw from one allowance; Anthropic describes Max as 5x/20x Pro capacity rather than fixed message counts; community anecdotes say Max 20x users rarely exhaust the five-hour window but concurrent worktree sessions for a week can reach the weekly limit. — [Zenken: Claude usage limits](https://ai.zenken.co.jp/en/post/claude-usage/); [chudi.dev](https://chudi.dev/blog/claude-usage-limits)
- Other vendors' concurrency caps: Jules 3 / 15 / 60 concurrent tasks by tier; Devin up to 10 sessions on Pro/Max (third-party); Cursor up to 8 parallel agents (third-party). — [Jules usage limits](https://jules.google/docs/usage-limits/); [usagebar: Devin](https://usagebar.com/blog/devin-pricing-and-rate-limits); [dsebastien notes](https://notes.dsebastien.net/30+Areas/33+Permanent+notes/33.02+Content/Cursor+Multi-Agents)

### Inferences
- The Team plan's 5-seat minimum makes it a poor fit for a 3-person hackathon team; three individual subscriptions (ideally Max 5x or higher for whoever runs the most agents) are simpler and allow Pro/Max-only features such as Projects.
- Realistic concurrency per person over 3.5 days: 1 "driver" session for design/integration plus 2-3 background or worktree sessions for well-scoped tasks (about 3-4 total). Beyond that, PR review, merge-conflict resolution and manual testing dominate; additional agents mostly produce unreviewed diffs.
- Cost-control levers that matter here: default teammates/subagents to Sonnet, reserve Opus for planning and hard bugs, `/clear` between unrelated tasks, keep CLAUDE.md short, avoid agent teams for routine work, and use `-p` headless only for bounded jobs.

### Gaps
- No official Anthropic page with numeric Pro/Max five-hour or weekly limits was retrieved; reports of a May 2026 doubling of subscription limits and an August 2026 temporary weekly boost appeared only in search summaries and were not verified.
- Current official Pro/Max/Team prices were not fetched from claude.com/pricing (figures above are third-party, mid-2026).

## 6. Recommended toolchain for the Saboot team (Hemang, Girish, Harshit; 3.5 days; at least one Windows 11 laptop)

### Takeaway
Use Claude Code as the primary tool on all three laptops (desktop Code tab on Windows, CLI wherever preferred), with one worktree per task, GitHub Issues plus PRs as the shared coordination layer, and committed AGENTS.md/CLAUDE.md plus a decisions log as the shared "memory." Optionally use Kiro (the sponsor's IDE) for a spec pass and judging narrative, reading the same AGENTS.md. Avoid experimental or single-user orchestration features (agent teams for implementation, Projects) and Mac-only or tmux-based third-party orchestrators.

### Cited Findings
- Desktop Code tab on Windows supports parallel sessions with a per-session worktree option, split view, PR monitoring, CI auto-fix and squash auto-merge (needs `gh`). — [Desktop](https://code.claude.com/docs/en/desktop)
- `claude --worktree <name>` / `claude --bg` give isolated parallel sessions from the CLI; `.worktreeinclude` copies `.env` into each worktree; background sessions open draft PRs and never push to main or merge. — [Worktrees](https://code.claude.com/docs/en/worktrees); [Agent view](https://code.claude.com/docs/en/agent-view)
- Agent teams are experimental, provide no worktree isolation, keep their task list/mailbox in local files, and cannot be shared across sessions; split panes don't work in Windows Terminal. — [Agent teams](https://code.claude.com/docs/en/agent-teams); [Run agents in parallel](https://code.claude.com/docs/en/agents)
- Projects are single-user, Pro/Max-only public beta with gradual rollout. — [Projects](https://code.claude.com/docs/en/claude-projects)
- Auto memory is machine-local; committed CLAUDE.md is the team-shared instruction channel; AGENTS.md is read natively by Claude Code and also by Copilot coding agent and Kiro. — [Memory](https://code.claude.com/docs/en/memory); [GitHub changelog](https://github.blog/changelog/2025-08-28-copilot-coding-agent-now-supports-agents-md-custom-instructions); [Kiro steering](https://kiro.dev/docs/steering/)
- Claude GitHub Action (`@claude`) can be set up via `/install-github-app`; with `CLAUDE_CODE_OAUTH_TOKEN` it bills to the subscription of whoever generated the token. — [GitHub Actions](https://code.claude.com/docs/en/github-actions)
- Conductor is macOS-only; claude-squad requires tmux; Vibe Kanban is sunsetting; Crystal is deprecated. — [conductor.build](https://www.conductor.build/); [claude-squad](https://github.com/smtg-ai/claude-squad); [vibekanban.com](https://www.vibekanban.com/); [stravu/crystal](https://github.com/stravu/crystal)
- Kiro supports Windows, specs as Markdown, steering in `.kiro/steering/`, AGENTS.md, and credit-metered usage. — [Kiro steering](https://kiro.dev/docs/steering/); [Morph: Kiro pricing](https://www.morphllm.com/kiro-pricing); [Windows Mode](https://www.windowsmode.com/kiro-ide-on-windows/amp/)

### Inferences
**Primary tool: Claude Code (desktop Code tab + CLI), with these features ON**
- Worktree isolation for every parallel session: desktop "worktree" toggle on Windows; `claude --worktree <task>` or `claude --bg` + `claude agents` on the CLI. Add `.claude/worktrees/` to `.gitignore` and a `.worktreeinclude` listing `.env`-type files.
- Committed shared context: `AGENTS.md` (architecture, module ownership map, commands, conventions, "read docs/decisions.md before starting") with `CLAUDE.md` containing `@AGENTS.md` plus Claude-specific notes; `docs/decisions.md` (append-only ADR-style log every agent updates in its PR); `docs/progress.md` or the GitHub Issues list as the task board.
- `.claude/agents/` with 2-3 small shared subagents committed to the repo (e.g., test-runner, reviewer, a refactorer with `isolation: worktree`), Sonnet by default.
- `.claude/settings.json` committed with a permission allowlist for routine commands (test, lint, `gh`, git) and optionally a PreToolUse hook that blocks edits to files owned by another person or blocks pushes to `main`.
- GitHub: Issues as the task board (one issue per agent task, labelled with owner), branch protection on `main`, a fast CI check, PR-per-task; desktop PR monitoring with auto-merge only when CI is meaningful.
- Subagents for research/verbose work inside each session; `/code-review` locally before opening PRs; optionally the Claude GitHub Action for `@claude` on PRs so any teammate can request a fix or review.
- Per-person concurrency: 1 driver session + 2-3 worktree/background sessions; one person acts as "integrator" each half-day to merge PRs and resolve conflicts.

**Optional secondary tool: Kiro**
- Use Kiro for a one-time spec pass (requirements/design/tasks Markdown committed to the repo) and to show sponsor-tool usage; it reads the same AGENTS.md and `.kiro/steering/`. Keep Kiro work on its own branch/worktree like any other agent. Alternative secondary choices: Codex app (native Windows, worktree per task) or Copilot coding agent (issue-to-PR, reads AGENTS.md) if a teammate already pays for them.

**Avoid or limit**
- Agent teams for parallel implementation (experimental, no worktree isolation, same-file overwrites, local-only task list, ~7x tokens in plan mode); acceptable only for a short parallel review or debugging session by one person.
- Projects (single-user, Pro/Max beta, rollout-gated) and relying on cross-session messaging or auto memory as team memory (both single-account/machine).
- Conductor (Mac-only), claude-squad/uzi (tmux; no native Windows), Sculptor (no Windows), Vibe Kanban (sunsetting), Crystal (deprecated), heavy swarm frameworks such as Ruflo (setup and supply-chain risk for 3.5 days).
- `--dangerously-skip-permissions` on Windows (no sandbox on native Windows) and `claude --cloud` bundle uploads from native Windows with uncommitted secrets.
- Long-lived branches: rebase on `main` frequently; with `worktree.baseRef: "fresh"`, new worktrees start from the remote default branch, so push merged work promptly.

### Gaps
- No hands-on validation of desktop Code-tab worktree sessions on Windows 11 for this specific repo, or of Kiro's behaviour alongside Claude Code worktrees.
- Whether each teammate's plan (Pro vs Max) is known was not provided; concurrency recommendations assume at least one Max subscription.
