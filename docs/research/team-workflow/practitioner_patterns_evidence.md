# Parallel coding agents: practitioner patterns, evidence, failure modes, and an operating model for Saboot

Research date: 2026-10-08. Sources run from Feb 2025 to Jul 2026. "Primary" means I fetched the original page. "Secondary" means I only saw a summary or a news write-up, and it is labelled that way at each point.

## 1. How experienced practitioners run parallel agents (2025–2026): agent counts, task types, rhythms

### Takeaway
Experienced practitioners run anywhere from 1 to about 15 agents. Running many agents mostly means many *independent* sessions, each with its own isolated checkout. In those sessions, research, read-only "how does this work" questions, small maintenance jobs, and well-specified tasks run in parallel. Each person still reviews and lands roughly one significant change at a time. Every practitioner names verification and a short shared memory file (CLAUDE.md or AGENTS.md) as the two things that make parallel work possible.

### Cited Findings
**Simon Willison (5 Oct 2025, primary)**
- He started out skeptical because "the natural bottleneck on all of this is how fast I can review the results". He has since adopted parallel agents, but says he can still only review and land one significant change at a time. — [Simon Willison, "Embracing the parallel coding agent lifestyle"](https://simonwillison.net/2025/Oct/5/parallel-coding-agents/)
- Four task types work in parallel for him:
  1. Research and proof-of-concept work whose code is not meant to be kept.
  2. "How does that work?" code-tracing questions. He saves the resulting notes as context for later prompts.
  3. Small maintenance tasks, such as fixing a deprecation warning.
  4. Carefully specified, directed work. This is quick to review because he has already decided the goals and the approach.
  — [Willison](https://simonwillison.net/2025/Oct/5/parallel-coding-agents/)
- Code that arrives unexpectedly costs more to review, because the reviewer first has to work out its goals. Starting from your own spec reduces that cost. — [Willison](https://simonwillison.net/2025/Oct/5/parallel-coding-agents/)
- He isolates agents with fresh checkouts (often in /tmp) rather than worktrees. He runs local agents in no-approval ("YOLO") mode only when untrusted instructions can't reach the context, and sends riskier work to cloud agents. — [Willison](https://simonwillison.net/2025/Oct/5/parallel-coding-agents/)
- He cites three other practitioners' patterns:
  - Jesse Vincent: an "architect" agent refines a plan, then fresh Claude Code instances implement and review it.
  - Josh Bleecher Snyder: a "scout" agent attempts a hard task purely to learn which files it touches and where the tricky parts are. Its code is not merged.
  - Peter Steinberger: a detailed process built around Codex CLI.
  — [Willison](https://simonwillison.net/2025/Oct/5/parallel-coding-agents/)

**Boris Cherny, creator of Claude Code (Jan 2026; InfoQ report of his X posts)**
- Runs about 5 local sessions in numbered terminal tabs plus 5–10 remote sessions on claude.ai/code. — [InfoQ, 10 Jan 2026](https://www.infoq.com/news/2026/01/claude-code-creator-workflow/)
- Each local session uses its own git checkout. — [InfoQ](https://www.infoq.com/news/2026/01/claude-code-creator-workflow/)
- 10–20% of remote sessions are abandoned "due to unexpected scenarios". — [InfoQ](https://www.infoq.com/news/2026/01/claude-code-creator-workflow/)
- For a PR he starts in Plan mode and iterates until he likes the plan, then switches to auto-accept edits ("A good plan is really important!"). — [InfoQ](https://www.infoq.com/news/2026/01/claude-code-creator-workflow/)
- Giving Claude a way to verify its work (tests, bash, browser) improves results 2–3x by his claim. — [InfoQ](https://www.infoq.com/news/2026/01/claude-code-creator-workflow/)
- Each team keeps a shared CLAUDE.md in git, about 2.5k tokens, that records mistakes. He tags coworkers' PRs to add learnings to it. — [InfoQ](https://www.infoq.com/news/2026/01/claude-code-creator-workflow/)
- Tooling details:
  - Uses `/commit-push-pr` dozens of times a day.
  - A PostToolUse hook runs the formatter after every edit to prevent CI failures.
  - Pre-approves safe commands rather than skipping permissions.
  - Uses Opus with thinking for all coding.
  — [InfoQ](https://www.infoq.com/news/2026/01/claude-code-creator-workflow/)
- Secondary coverage gives the total as about 10–15 concurrent sessions. Sources disagree on whether he uses worktrees or separate checkouts; InfoQ says separate checkouts. — [Karo Zieminski summary](https://karozieminski.substack.com/p/boris-cherny-claude-code-workflow); [InfoQ](https://www.infoq.com/news/2026/01/claude-code-creator-workflow/)

**incident.io (27 Jun 2025, primary)**
- Engineers went from no Claude Code to running four or five agents at once, each on a different feature, with each session in its own git worktree. The author of the post ran seven conversations at once. — [incident.io blog](https://incident.io/blog/shipping-faster-with-claude-code-and-git-worktrees)
- Workflow details:
  - A `w` bash helper creates a worktree and launches Claude in one step.
  - Plan mode lets sessions investigate unattended without making changes.
  - Engineers dictate about 5 minutes of context by voice (SuperWhisper), tag files, and then ask for a spec.
  — [incident.io](https://incident.io/blog/shipping-faster-with-claude-code-and-git-worktrees)
- Example result: a JavaScript editor feature Claude estimated at 2 hours was about 90% working in 10 minutes, with UI nits left over. — [incident.io](https://incident.io/blog/shipping-faster-with-claude-code-and-git-worktrees)
- Lessons the team drew:
  - A shared working directory makes sessions collide.
  - Parallel sessions strain local databases, ports and services.
  - Engineers stay responsible for shipped code.
  - They don't rely on Claude for major architectural decisions.
  — [incident.io](https://incident.io/blog/shipping-faster-with-claude-code-and-git-worktrees)

**Mitchell Hashimoto (5 Feb 2026, primary)**
- During the day he runs background agents "one at a time, not in parallel". He says "I'm not [yet?] running multiple agents, and currently don't really want to." — [Mitchell Hashimoto, "My AI Adoption Journey"](https://mitchellh.com/writing/my-ai-adoption-journey)
- He uses parallel agents only for:
  - end-of-day exploratory runs on vague ideas,
  - deep-research surveys,
  - issue triage with `gh`. Triage agents may not post replies; he reads their reports the next morning.
  — [Hashimoto](https://mitchellh.com/writing/my-ai-adoption-journey)
- Each morning he picks "slam dunk" issues an agent will "almost certainly solve well" and runs them in the background while he does deep work himself. — [Hashimoto](https://mitchellh.com/writing/my-ai-adoption-journey)
- "Harness engineering": every agent mistake gets either a line in AGENTS.md or a tool (screenshot script, filtered test runner) so it "never makes that mistake again". — [Hashimoto](https://mitchellh.com/writing/my-ai-adoption-journey)
- He turns off agent notifications because "Context switching is very expensive". He has a background agent running only about 10–20% of the working day, and says "I don't want to run agents for the sake of running agents." — [Hashimoto](https://mitchellh.com/writing/my-ai-adoption-journey)

**Harper Reed (16 Feb 2025, primary; older but widely copied)**
- His workflow:
  1. An LLM asks one question at a time to hone the idea into `spec.md`.
  2. A reasoning model turns the spec into a step-by-step `prompt_plan.md`.
  3. A `todo.md` checklist keeps state across sessions.
  4. Execution runs with tests (aider runs the suite and fixes failures).
  — [Harper Reed, "My LLM codegen workflow atm"](https://harper.blog/2025/02/16/my-llm-codegen-workflow-atm/)
- He says the workflow is solo-only: it is "not easy to use as a team". The bots collide, merges get messy, and context gets complicated. He wanted someone to make LLM coding "multiplayer". — [Harper Reed](https://harper.blog/2025/02/16/my-llm-codegen-workflow-atm/)

**Anthropic internal (primary)**
- Nicholas Carlini's C compiler project (5 Feb 2026) is the most detailed public account of many parallel writers. All details below are from [Anthropic Engineering, "Building a C compiler with a team of parallel Claudes"](https://www.anthropic.com/engineering/building-c-compiler).
  - **Scale and cost:**
    - 16 parallel Claude (Opus 4.6) agents wrote a roughly 100k-line Rust C compiler.
    - It took about 2,000 sessions over about 2 weeks.
    - Total cost was just under $20,000.
  - **Coordination:**
    - Each agent had its own container and clone, and pushed to a shared bare repo.
    - Agents claimed tasks by writing lock files to `current_tasks/`.
    - There was no orchestrator.
    - Merge conflicts were frequent, and Claude resolved them itself.
  - **Role specialization:** some agents were assigned to:
    - remove duplicate code,
    - improve compiler performance,
    - improve the efficiency of generated code,
    - critique Rust code quality,
    - maintain documentation.
  - **Verification was the core lesson:**
    - The verifier "must be nearly perfect" or Claude solves the wrong problem.
    - Test output was kept short, with greppable ERROR lines.
    - A `--fast` random-sample mode kept test runs quick.
    - Agents kept READMEs and progress files.
    - CI was added later because new features kept breaking existing ones.
  - **Where parallelism collapsed:** on one giant task (compiling the Linux kernel), every agent hit the same bug and they overwrote each other's fixes. The fix was to split the work using GCC as a known-good oracle.
- "How Anthropic teams use Claude Code" (24 Jul 2025):
  - Product Design runs autonomous write–test–iterate loops and then reviews the result.
  - Security Engineering moved to pseudocode, then TDD with periodic check-ins.
  - Data science uses one-shot attempts and retries.
  - The page does not describe running parallel sessions.
  — [Claude blog](https://claude.com/blog/how-anthropic-teams-use-claude-code)

**Steve Yegge (Jan 2026 onward; secondary only)**
- Gas Town, released 1 Jan 2026, orchestrates 20–30 or more Claude Code instances. Yegge calls it alpha, "100% vibe coded", and says it may need several Max subscriptions. — [heise](https://heise.de/-11178824); [The New Stack](https://thenewstack.io/steve-yegges-ai-agent-orchestration-project-gas-town-comes-to-the-cloud-and-brings-the-wasteland-with-it/)
- It has a dedicated "Refinery" merge-queue role that detects conflicts, merges in dependency order and verifies integration. — [skills listing, secondary](https://www.skillsdirectory.com/skills/a5c-ai-merge-queue)
- On a project running about 40 agents (about 175 commits a day), his merge queue grew past 160. He switched to landing 120–150 commits at once and "swarm diagnosing" when main went red. — [Julien Danjou critique, secondary](https://julien.danjou.info/blog/steve-yegge-deleted-the-wrong-thing)

**Kent Beck (mid-2025; secondary summaries)**
- He describes the agent as an "unpredictable genie" and TDD as a "superpower" against its regressions. His system prompt has the agent take the next unmarked test from a plan file and write only enough code to pass it. — [Kent Beck summary](https://www.kentbeck.com/summaries/augmented-coding-beyond-the-vibes/); [Pragmatic Engineer podcast](https://newsletter.pragmaticengineer.com/p/tdd-ai-agents-and-coding-with-kent)
- Warning signs he watches for: unnecessary loops, features nobody asked for, and agents disabling or deleting tests. — [Aktagon summary, AI-generated/human-reviewed](https://signals.aktagon.com/articles/2025/09/augmented-coding-beyond-the-vibes/)

**Armin Ronacher (secondary for the parallel-team point)**
- His December 2025 year-end post says Claude Code's innovations were "still state of the art" for him. By January 2026 he was using Pi almost exclusively. — [lucumr, "A Year of Vibes"](https://lucumr.pocoo.org/2025/12/22/a-year-of-vibes/); [lucumr, Pi](https://lucumr.pocoo.org/2026/1/31/pi/)
- Two views reported only in summaries:
  - His team keeps small libraries with clear boundaries because these give agents clearer constraints.
  - A July 2026 essay argues that agents let engineers ship in parallel *without* the pull-request, review and interface-negotiation steps that used to keep the team's shared mental model in sync.
  — [AI Engineer speaker bio](https://www.ai.engineer/speakers/armin-ronacher); [AI-TLDR summary of "The Tower Keeps Rising"](https://ai-tldr.dev/releases/lucumr-tower-keeps-rising-jul13/)

**Official Claude Code guidance (current docs, primary)**
- Multi-session options it lists:
  - worktrees,
  - cross-session messaging,
  - the desktop app,
  - cloud sessions,
  - agent view,
  - experimental agent teams.
  — [Claude Code best practices](https://code.claude.com/docs/en/best-practices)
- It recommends a Writer/Reviewer split across two sessions, because fresh context reviews better. It also suggests having "one Claude write tests, then another write code to pass them". — [Claude Code best practices](https://code.claude.com/docs/en/best-practices)
- For large mechanical changes, `/batch` splits the work across 5–30 subagents, each in its own worktree. — [Claude Code best practices](https://code.claude.com/docs/en/best-practices)

### Inferences
- Counts depend on the person. At the top end, the tool's creator runs about 10–15 sessions and abandons 10–20% of them. In mid-size product teams like incident.io, it is 4–5 per engineer. At the other end, Mitchell Hashimoto runs about 1 during the day and deliberately avoids more. Every practitioner caps what they review and merge, not what they start.
- Everyone above uses parallel agents mostly for low-review-cost work: research, scouts, triage, read-only questions, and pre-specified chores. Feature-writing agents tend to be few per person and placed in isolated areas.
- What makes it work is the same in every account: a written plan or spec before code, an automated check the agent can run, an isolated checkout per session, and a short shared memory file in git.

### Gaps
- I could not fetch Cherny's original X thread or Ronacher's July 2026 essay. Their numbers come from news or summary reports.
- I found no primary Kent Beck text and no primary Yegge text on merge queues.
- "How Anthropic teams use Claude Code" does not mention the often-quoted "slot machine" approach (commit, let it run about 30 minutes, then accept or restart). That may be in the companion PDF, which I did not verify.

## 2. Coordination patterns: what helps, what hurts, and how practitioners reconcile Cognition's "Don't Build Multi-Agents"

### Takeaway
Most practitioners resolve the tension the same way, and Cognition's own 2026 follow-up says it outright: keep **writes single-threaded per area**, and use extra agents to add intelligence (research, review, planning, scouting, verification), not to write in parallel. Parallel *writers* only work when they own disjoint files and share a written plan, contracts, and a strong automated verifier.

### Cited Findings
- **Cognition, "Don't Build Multi-Agents" (Walden Yan, 12 Jun 2025):** it states two principles.
  - "Share context, and share full agent traces, not just individual messages."
  - "Actions carry implicit decisions," and "conflicting decisions carry bad results."
  — [Cognition](https://cognition.com/blog/dont-build-multi-agents)
- Its Flappy Bird example: one subagent built a Super Mario-style background and another built a bird that didn't fit with it. Even with shared context, the two subagents chose different visual styles. — [Cognition](https://cognition.com/blog/dont-build-multi-agents)
- The post recommends a single-threaded linear agent plus context compression. It notes that Claude Code's subagents answer narrow questions rather than writing code in parallel. — [Cognition](https://cognition.com/blog/dont-build-multi-agents)
- **Cognition follow-up, "Multi-Agents: What's Actually Working" (22 Apr 2026):** multi-agent setups work when "writes stay single-threaded and the additional agents contribute intelligence rather than actions". — [Cognition](https://cognition.com/blog/multi-agents-working)
- The follow-up names three patterns that work:
  - **Coder–reviewer loop.** It works best "when the coding and review agents do not share any context beforehand". Devin Review flags about 2 bugs per PR, and about 58% of those are severe.
  - **"Smart friend" escalation**, where a smaller model calls a stronger one.
  - **Manager/child map-reduce.**
  — [Cognition](https://cognition.com/blog/multi-agents-working)
- About parallel-writer swarms, the follow-up says "most of the sexy ideas in that space still don't see meaningful adoption". It also says child agents should not be assumed to share state, so messaging between them must be explicit. — [Cognition](https://cognition.com/blog/multi-agents-working)
- **Anthropic multi-agent research system (Jun 2025; secondary coverage):**
  - Multi-agent setups use about 15x the tokens of chat, and single agents use about 4x.
  - They are "less effective for tightly interdependent tasks such as coding".
  - They fit poorly in domains that need all agents to share context or that have many dependencies.
  — [Slashdot summary](https://developers.slashdot.org/story/25/06/21/0442227/anthropic-deploys-multiple-claude-agents-for-research-tool---says-coding-is-less-parallelizable); [ByteByteGo](https://blog.bytebytego.com/p/how-anthropic-built-a-multi-agent)
- **Claude Code agent teams docs (primary):**
  - The strongest uses are research and review, new modules where each teammate "own[s] a separate piece", debugging with competing hypotheses, and cross-layer work where frontend, backend and tests are each owned by a different teammate.
  - For "sequential tasks, same-file edits, or work with many dependencies," a single session is better.
  — [Claude Code agent teams](https://code.claude.com/docs/en/agent-teams)
- Sizing guidance from the same docs:
  - "Start with 3-5 teammates."
  - "Three focused teammates often outperform five scattered ones."
  - Aim for 5–6 tasks per teammate.
  - Tasks should be "self-contained units that produce a clear deliverable".
  - "Two teammates editing the same file leads to overwrites."
  - Beginners should start with research and review before parallel implementation.
  — [Claude Code agent teams](https://code.claude.com/docs/en/agent-teams)
- Agent teams are experimental and off by default, and they use "significantly more tokens". Split-pane mode is not supported in Windows Terminal or the VS Code integrated terminal. — [Claude Code agent teams](https://code.claude.com/docs/en/agent-teams)
- **Explore → plan → code → commit** is the official workflow. Planning is worth it when the approach is uncertain or the change spans several files. "If you could describe the diff in one sentence, skip the plan." — [Claude Code best practices](https://code.claude.com/docs/en/best-practices)
- **Spec, then implement:** have Claude interview you, write SPEC.md, then "start a fresh session to execute it". Good specs name the files and interfaces involved, state what is out of scope, and end with an end-to-end verification step. — [Claude Code best practices](https://code.claude.com/docs/en/best-practices)
- **Tasks with clear verification:**
  - "Give Claude a check it can run... It's the difference between a session you watch and one you walk away from."
  - Have Claude show evidence (test output, screenshots) rather than just assert success.
  - Hooks can be deterministic gates, for example "a hook that blocks writes to the migrations folder".
  — [Claude Code best practices](https://code.claude.com/docs/en/best-practices)
- **Adversarial review subagent:** a fresh-context reviewer checks the diff against PLAN.md. The docs caution that a reviewer told to find gaps will always find some, so chasing every finding leads to over-engineering. Restrict it to correctness and stated requirements. — [Claude Code best practices](https://code.claude.com/docs/en/best-practices)
- **Independent parallel tasks with claim locks work** (C compiler lock files; agent-teams file-locked task claiming). **One shared giant task fails:** agents overwrote each other's fixes. — [Anthropic C compiler](https://www.anthropic.com/engineering/building-c-compiler); [agent teams](https://code.claude.com/docs/en/agent-teams)
- **Scout pattern:** send an agent at a hard task only to learn which files it touches. Its code is not merged. — [Willison](https://simonwillison.net/2025/Oct/5/parallel-coding-agents/)
- **Architect agent, then fresh implementers:** this is Jesse Vincent's setup, as cited by Willison. — [Willison](https://simonwillison.net/2025/Oct/5/parallel-coding-agents/)
- **Failure taxonomy (MAST, Cemri et al., NeurIPS 2025):** analysis of more than 1,600 traces found 14 failure modes in 3 categories: specification issues, inter-agent misalignment, and task verification. Inter-agent misalignment is about 37% of failures (one version gives 32.3%). Its sub-modes include:
  - reasoning–action mismatch, 13.2%
  - task derailment, 7.4%
  - failure to ask for clarification, 6.8%
  — [arXiv 2503.13657](https://arxiv.org/html/2503.13657v3); [MAST project page](https://sites.google.com/berkeley.edu/mast/)

### Inferences
- How to reconcile Cognition with running many agents:
  1. Run many agents, but give each area of the codebase exactly one writing session at a time.
  2. Make every other agent read-only (research, scout, explain), a reviewer with fresh context, or a writer in a *disjoint* area under a written contract.
  3. Put the "implicit decisions" Cognition warns about into explicit shared files that every session reads: contracts, a decisions log, the plan.
- For Saboot this maps naturally to three humans, three areas and three writing "trunks". Parallel writers are separated by directory, and their interfaces are frozen in contract files.
- Orchestrator/worker setups (agent teams, Gas Town) add token cost and coordination overhead. They are still experimental, and split-pane mode doesn't work on Windows terminals. For a 3.5-day hackathon, manual sessions plus worktrees plus a shared plan and decisions file carry less risk than adopting a new orchestration tool mid-event.

### Gaps
- I found no controlled comparison of orchestrator–worker setups against human-owned workstreams for small teams. All the evidence is anecdotal or vendor-reported.
- I saw only part of Anthropic's original multi-agent research post, mostly through secondary summaries.

## 3. Empirical evidence on productivity, stability, review burden, churn, and agent merge conflicts

### Takeaway
The hard evidence is mixed:
- Experienced developers were measurably *slower* with early-2025 tools, and they misjudged their own speed.
- Late-2025 data points toward speedups, but it is statistically weak.
- AI raises throughput together with instability (DORA).
- Higher output piles up at review (Faros), adds duplication and churn (GitClear), and agents working at the same time cause many merge conflicts, especially structural ones.

For three people, this means: measure progress by the working demo path, not by how fast it feels. Keep changes small. Treat review and integration as the scarce resources.

### Cited Findings
**METR 2025 and its 2026 follow-up**
- **Original study (10 Jul 2025, primary):**
  - Design: 16 experienced open-source developers, 246 real tasks of about 2 hours each, in mature repos with 22k+ stars and 1M+ lines of code.
  - Result: with AI (mainly Cursor with Claude 3.5/3.7 Sonnet), tasks took **19% longer**.
  - Perception: developers forecast a 24% speedup, and afterwards believed they had been about 20% faster.
  - Caveats: a small sample, only experienced developers in familiar codebases, and fewer than about 50 hours of tool experience.
  — [METR 2025](https://metr.org/blog/2025-07-10-early-2025-ai-experienced-os-dev-study/)
- The METR page now says the July 2025 results are out of date and points to a February 2026 continuation. — [METR 2025](https://metr.org/blog/2025-07-10-early-2025-ai-experienced-os-dev-study/)
- **Follow-up (24 Feb 2026, primary):**
  - Design: 57 developers, 143 repos, more than 800 tasks.
  - Returning developers: about **18% faster**, with a 95% CI from 38% faster to 9% slower.
  - New developers: about 4% faster (CI from 15% faster to 9% slower).
  - Selection effects: 30–50% of developers said they skipped submitting some tasks because they didn't want to do them without AI, so the estimate is biased downward.
  - Timing: "it was challenging to report time-spent... when they used agentic tools", because developers worked on other things while agents ran.
  - METR's view: developers are probably faster in early 2026 than in early 2025, but its data is "only very weak evidence" for that.
  — [METR uplift update](https://metr.org/blog/2026-02-24-uplift-update/)

**DORA**
- **2025 report (Sept 2025):**
  - AI adoption among developers reached 90%, up from 76% in 2024, in a survey of about 5,000 professionals.
  - AI "improves throughput, but often at the cost of stability if your foundation isn't solid".
  - "AI adoption not only fails to fix instability, it is currently associated with increasing instability."
  - DORA frames AI as an amplifier of a team's existing strengths and weaknesses.
  — [DORA 2025 year in review](https://dora.dev/insights/dora-2025-year-in-review/); [InfoQ](https://www.infoq.com/news/2025/09/dora-state-of-ai-in-dev-2025); [RedMonk](https://redmonk.com/rstephens/2025/12/18/dora2025/)
- **2024 report (as reported by TechTarget):** every 25% increase in AI adoption went with a 1.5% drop in delivery throughput and a 7.2% drop in stability. Some secondary sources wrongly attribute these figures to the 2025 report. — [TechTarget](https://www.techtarget.com/searchSoftwareQuality/news/366631712/Google-DORA-Software-delivery-caught-up-to-AI-coding-tools)
- **2025 DORA AI Capabilities Model:** it names seven capabilities that amplify AI benefits:
  - clear AI policy
  - healthy data ecosystems
  - AI-accessible internal data
  - strong version control
  - **small batches**
  - **user-centric focus**
  - quality internal platforms
  Coverage of the report says AI can harm teams that lack a user-centric focus, making it "easier to build the wrong thing faster". — [dora.dev capabilities model](https://dora.dev/research/2025/ai-capabilities-model); [Google Cloud blog](https://cloud.google.com/blog/products/ai-machine-learning/from-adoption-to-impact-putting-the-dora-ai-capabilities-model-to-work/)

**Faros AI (secondary)**
- Telemetry (June 2025; more than 10,000 developers on 1,255 teams; secondary):
  - High AI adoption went with about 21% more tasks completed and 98% more PRs merged.
  - PR review time rose 91%.
  - Company-level throughput and lead time were flat.
  — [Unblocked summary](https://getunblocked.com/blog/ai-productivity-paradox/index.md); [Augment Code summary](https://www.augmentcode.com/guides/ai-productivity-paradox-engineering-delivery)
- Secondary figures for PR size and bug growth conflict with each other: 154% vs 51.3% for PR size, and 9% vs 54% for bugs. — [Augment](https://www.augmentcode.com/guides/ai-productivity-paradox-engineering-delivery); [Faros FAQ](https://www.faros.ai/comparison/github-copilot-vs-codeium)
- Faros sells tooling for exactly these bottlenecks, which is a conflict of interest.

**GitClear 2025 (secondary)**
- Dataset: 211M changed lines from 2020–2024.
- Duplicated blocks of 5 or more lines grew about 8x in 2024.
- "Moved" (refactored) lines fell about 40%.
- 2024 was the first year copy-pasted lines outnumbered moved lines.
- More revised code is now recent code; churn is defined as lines reverted or updated within 2 weeks of being written.
- GitClear sells code-review tooling, and the secondary sources disagree on exact percentages.
— [GitClear research page](https://www.gitclear.com/ai_assistant_code_quality_2025_research); [DevClass](https://devclass.com/2025/02/20/ai-is-eroding-code-quality-states-new-in-depth-report/)

**Agent PR acceptance (arXiv 2509.14745, accepted to TOSEM; secondary for these figures)**
- The study covers 567 Claude Code PRs in 157 projects.
- 83.8% were merged, against 91.0% for human PRs, and 54.9% of the merged PRs needed no modification.
- Rejections came mostly from project context, such as alternative solutions or PR size, rather than flaws in the code.
— [arXiv 2509.14745](https://arxiv.org/html/2509.14745v3)

**Agent merge conflicts (arXiv 2607.04697, Jul 2026; secondary for these figures)**
- The study covers 33,596 agent-authored PRs across 2,807 repos (Codex, Copilot, Devin, Cursor and Claude Code), Dec 2024 to Jul 2025.
- 40.2% of repos had agent PRs overlapping in time, and those overlaps covered 79.4% of agent PRs.
- Replayed three-way merges conflicted in 19.8% of same-agent pairs and **41.7%** of cross-vendor pairs.
- 84.4% of conflicted files were source code, and only 3.9% were manifests or lockfiles.
- About 42% of conflicts were structural: modify/delete 26.8%, add/add 15.1%.
- Only textual conflicts were counted, so semantic and build conflicts come on top of these.
— [arXiv 2607.04697](https://arxiv.org/abs/2607.04697); [Daniel Vaughan summary](https://codex.danielvaughan.com/2026/07/28/agent-pr-merge-conflicts-concurrent-coding-agents-codex-cli-worktree-isolation-coordination-defence/)

### Inferences
- **For a 3-person team, the METR results mean:**
  - Don't trust "it feels fast". Developers' estimates were off by about 40 points in 2025.
  - Track progress by what runs end-to-end on the demo path.
  - The tools have improved since 2025. The likely loss of speed now comes from time spent supervising, reviewing and integrating, not from typing.
- **The DORA and Faros results mean:** expect more code and more breakage. With three people over 3.5 days there is almost no "foundation" (CI, platform) to absorb that instability, so build a minimal one on day 1: one smoke test of the demo path, plus lint and type checks.
- **The GitClear results mean:** parallel agents in separate sessions tend to re-implement helpers rather than reuse them. A shared `lib/` or `contracts/` area, with a rule to "search for existing utilities first", reduces this.
- **The merge-conflict study means:** conflicts between agents are common, and structural ones (both agents add the same file, or one deletes what the other changes) are the dominant costly kind. Scaffold every shared file once, early, by one person, so agents never "add/add" the same module.

### Gaps
- I found no rigorous study of hackathon-scale (2–4 people, about 3 days) multi-agent development.
- I found no GitHub or Google RCT from 2025–2026 on agentic (not autocomplete) tools.
- I found no DORA 2026 report as of this research date.
- The Faros, GitClear and merge-conflict figures above come from secondary summaries; the original reports were not opened.

## 4. Common failure modes when several agents or people work at once, with mitigations

### Takeaway
Most failures come from shared state nobody owns: shared files, an implicit interface, the main branch, the human's attention, and the token budget. The mitigations are ownership by directory, explicit contracts, isolated checkouts, small verified merges, written decision logs, and caps on concurrent sessions.

### Cited Findings
- **Duplicated work or the same task claimed twice.**
  - Evidence: agents had to use lock files to claim tasks; agent teams use file-locked claiming.
  - Mitigation: an explicit claim step on a shared list.
  — [C compiler](https://www.anthropic.com/engineering/building-c-compiler); [agent teams](https://code.claude.com/docs/en/agent-teams)
- **Duplicate submissions among agent PRs.** A 2026 study of about 33k agent PRs lists duplicate submissions, reviewer abandonment and CI build failures as failure causes; this was seen only via a summary page. — [search summary of arXiv 2605/2607 studies](https://www.alphaxiv.org/abs/2605.22534.md)
- **Divergent implicit assumptions** (two agents define the same thing differently).
  - Evidence: Cognition's Flappy Bird example; MAST puts inter-agent misalignment at about 37%; parallel agents make "implicit choices about style, edge cases".
  - Mitigation: share plans and todo files, and keep writes single-threaded.
  — [Cognition 2025](https://cognition.com/blog/dont-build-multi-agents); [Cognition 2026](https://cognition.com/blog/multi-agents-working); [MAST](https://arxiv.org/html/2503.13657v3)
- **Merge hell.**
  - Harper Reed: "bots collide, merges get messy".
  - A hackathon post-mortem reports "hours of git sync problems, conflicts, and branch issues" from parallel worktree sessions.
  - Cross-agent conflict rate is 41.7% (study above).
  — [Harper Reed](https://harper.blog/2025/02/16/my-llm-codegen-workflow-atm/); [Muxin Li, "How NOT to Use Claude Code", 28 Apr 2026](https://humaninference.substack.com/p/why-i-didnt-win-the-opus-47-hackathon); [arXiv 2607.04697](https://arxiv.org/abs/2607.04697)
- **Agents overwriting each other's files.**
  - "Two teammates editing the same file leads to overwrites."
  - On one giant shared task, agents "overwrote each other's fixes".
  - A shared working directory makes sessions collide.
  - Mitigations: own disjoint file sets, one worktree or checkout per session, and split giant tasks using an oracle.
  — [agent teams](https://code.claude.com/docs/en/agent-teams); [C compiler](https://www.anthropic.com/engineering/building-c-compiler); [incident.io](https://incident.io/blog/shipping-faster-with-claude-code-and-git-worktrees)
- **Broken main or regressions.**
  - New features often broke existing functionality until CI gated commits.
  - Yegge's "land rush" left main red, to be fixed by swarms.
  - DORA links AI to instability.
  - Mitigation: a fast test gate, with a quick sample mode if needed.
  — [C compiler](https://www.anthropic.com/engineering/building-c-compiler); [Danjou](https://julien.danjou.info/blog/steve-yegge-deleted-the-wrong-thing); [DORA](https://dora.dev/insights/dora-2025-year-in-review/)
- **Context drift and context rot within a session.**
  - "LLM performance degrades as context fills."
  - Failure patterns the docs name: the "kitchen sink session" and "correcting over and over".
  - Fixes: run `/clear` between tasks, and after two failed corrections start fresh with a better prompt. Compaction can be told to preserve the list of modified files and the test commands.
  — [Claude Code best practices](https://code.claude.com/docs/en/best-practices)
- **Context rot in reviewers.** A reviewer with clean context avoids "context rot from a long coding session". — [Cognition 2026](https://cognition.com/blog/multi-agents-working)
- **Bloated shared memory.** A CLAUDE.md that is too long gets ignored ("Bloated CLAUDE.md files cause Claude to ignore your actual instructions"). Keep it short, check it into git, and turn must-always rules into hooks. — [Claude Code best practices](https://code.claude.com/docs/en/best-practices)
- **Mocked but never integrated, or acceptance criteria met only literally.**
  - In a hackathon post-mortem, subagents "did just enough to satisfy acceptance criteria" and missed the real goal, such as wiring data across the UX.
  - The "trust-then-verify gap": plausible code that misses edge cases. Fix: "If you can't verify it, don't ship it."
  — [Muxin Li](https://humaninference.substack.com/p/why-i-didnt-win-the-opus-47-hackathon); [best practices](https://code.claude.com/docs/en/best-practices)
- **Agents gaming tests.**
  - Kent Beck reports agents deleting or disabling tests to make them pass.
  - A verifier that is not near-perfect leads Claude to solve the wrong problem.
  — [Pragmatic Engineer/Beck](https://newsletter.pragmaticengineer.com/p/tdd-ai-agents-and-coding-with-kent); [C compiler](https://www.anthropic.com/engineering/building-c-compiler)
- **Review bottleneck.**
  - Simon Willison: "the natural bottleneck... is how fast I can review the results".
  - Faros: review time +91% (secondary).
  - Mitigations: DORA's small batches, and code produced from your own spec, which is cheaper to review.
  — [Willison](https://simonwillison.net/2025/Oct/5/parallel-coding-agents/); [Unblocked/Faros](https://getunblocked.com/blog/ai-productivity-paradox/index.md); [dora.dev](https://dora.dev/research/2025/ai-capabilities-model)
- **The human as bottleneck, and fatigue.**
  - Hashimoto turns off notifications ("Context switching is very expensive") and checks agents at natural breaks.
  - Lenny Rachitsky reportedly felt worn out by late morning after running four agents (secondary, via a Willison Q&A).
  — [Hashimoto](https://mitchellh.com/writing/my-ai-adoption-journey); [search summary](https://texxr.com/1166483/simon-willison-discusses-gpt-51-opus-45)
- **Over-scoping and overloading a session.** Without a backlog, the author of one post-mortem kept sending Claude new tasks, so no single task was finished well. Long voice dumps containing several tangled tasks made it worse. Mitigation: one focused task per session, plus a backlog. — [Muxin Li](https://humaninference.substack.com/p/why-i-didnt-win-the-opus-47-hackathon)
- **Over-engineered process for a hackathon.** Production-grade scaffolding from a research tool caused "context poisoning" and bureaucracy. Lesson: match the process to the size of the task. — [Muxin Li](https://humaninference.substack.com/p/why-i-didnt-win-the-opus-47-hackathon)
- **Token burn and rate limits.**
  - Agent teams' token cost scales linearly with teammates.
  - Multi-agent setups use about 15x chat tokens (secondary).
  - The C compiler cost about $20k over 2 weeks.
  - Gas Town may need several Max subscriptions (secondary).
  — [agent teams](https://code.claude.com/docs/en/agent-teams); [ByteByteGo](https://blog.bytebytego.com/p/how-anthropic-built-a-multi-agent); [C compiler](https://www.anthropic.com/engineering/building-c-compiler); [heise](https://heise.de/-11178824)
- **Local resource collisions.** Parallel sessions strain local DBs, ports and services. — [incident.io](https://incident.io/blog/shipping-faster-with-claude-code-and-git-worktrees)
- **Abandoned sessions.** Even the creator of Claude Code abandons 10–20% of remote sessions. — [InfoQ](https://www.infoq.com/news/2026/01/claude-code-creator-workflow/)
- **Lost team mental model.** Agents let engineers skip the PR, review and interface negotiation that used to keep the team's understanding in sync (Ronacher, via a secondary summary). — [AI-TLDR](https://ai-tldr.dev/releases/lucumr-tower-keeps-rising-jul13/)

### Inferences
Failure mode, then the mitigation for Saboot:
- **Duplicate work:** one GitHub issue per task with an assignee or label as the claim. The agent checks the issue before starting.
- **Divergent API definitions:** `contracts/` folder with the API schema, the GeoJSON/feature schema and the data-file layout. Only the integration lead merges changes to it, and an agent must stop and ask before editing it.
- **Overwriting:** worktree per session, and directories owned per person (`frontend/`, `data/`, `agent/`). Optionally, a PreToolUse hook blocks edits outside the session's directory.
- **Merge hell:** small PRs, a few hours old at most. Rebase on main before opening a PR. One person scaffolds all shared files at the start.
- **Broken main:** never push directly. Before merge, run `make smoke`, a 1–2 minute end-to-end demo-path check plus lint and types.
- **Context drift:** one task per session, `/clear` between tasks, plans in files, and the session writes its decisions to DECISIONS.md before ending.
- **Mocked but never integrated:** every mock is registered as an "integration debt" issue with an owner. Integration checkpoints run on real data.
- **Review bottleneck:** each owner merges in their own area after a self-review subagent and a green smoke test. Cross-area changes get a human glance from the other owner of 10 minutes at most.
- **Human bottleneck:** at most one writing session per person that needs attention. Other sessions are read-only or async. Notifications off; check sessions at breaks.
- **Rate limits:** Opus for planning and hard work. Cheaper models for research subagents if the plan allows. Don't run agent teams. Watch `/context` and the cost/usage views.

### Gaps
- I found no quantitative data on rate-limit exhaustion for Claude subscriptions in team hackathon settings.
- I found no study that measures "mocked-but-never-integrated" as a defect class. The evidence is post-mortem anecdote.

## 5. Team rituals that fit a hackathon with AI agents

### Takeaway
There is little direct evidence from hackathons. The closest is a single, cautionary post-mortem. The rituals below are therefore extrapolated from small-batch, CI and verification evidence and from practitioner rhythms. They are:
- agree contracts and a vertical skeleton first,
- integrate often against a single demo-path smoke test,
- keep a written decision log,
- review shared memory at the end of each day,
- queue overnight or idle agent work that is read-only.

### Cited Findings
- **Small batches** are one of DORA's seven AI capabilities. Large AI-generated changes are "hard to review, test, and integrate". — [dora.dev](https://dora.dev/research/2025/ai-capabilities-model); [DEV summary](https://dev.to/pinishv/ship-faster-without-breaking-things-dora-2025-in-real-life-ng5)
- **User-centric focus:** teams without it can be harmed by AI ("build the wrong thing faster"). For a hackathon, the "user" is the judge watching a 3-minute video. — [Google Cloud blog](https://cloud.google.com/blog/products/ai-machine-learning/from-adoption-to-impact-putting-the-dora-ai-capabilities-model-to-work/)
- **End-of-day agent runs** (research, triage, exploration) give a "warm start" the next morning. Triage agents are not allowed to act. — [Hashimoto](https://mitchellh.com/writing/my-ai-adoption-journey)
- **Shared CLAUDE.md maintained as a ritual:** Anthropic teams record mistakes in it, and Cherny tags PRs to add learnings. Mitchell Hashimoto adds an AGENTS.md line after each agent error. — [InfoQ](https://www.infoq.com/news/2026/01/claude-code-creator-workflow/); [Hashimoto](https://mitchellh.com/writing/my-ai-adoption-journey)
- **Progress files and READMEs kept by the agents** gave coherence across about 2,000 fresh sessions. — [C compiler](https://www.anthropic.com/engineering/building-c-compiler)
- **Plan files and todo lists keep agents "on the same page"**, with the same information sources, plan and priors. — [Cognition 2026](https://cognition.com/blog/multi-agents-working); [Harper Reed todo.md](https://harper.blog/2025/02/16/my-llm-codegen-workflow-atm/)
- **Monitor and steer:** "Letting a team run unattended for too long increases the risk of wasted effort." — [agent teams](https://code.claude.com/docs/en/agent-teams)
- **Hackathon post-mortem lessons:**
  - Match process to task size.
  - Keep a backlog.
  - Do one focused task at a time.
  - Be cautious with parallel worktrees unless you can manage git sync.
  - Check that the underlying intent is met, not just the literal criteria.
  — [Muxin Li](https://humaninference.substack.com/p/why-i-didnt-win-the-opus-47-hackathon)
- **Model choice and quality:** Cherny uses Opus with thinking because it is "faster overall" once fewer corrections are needed. — [InfoQ](https://www.infoq.com/news/2026/01/claude-code-creator-workflow/)

### Inferences
These rituals for Saboot are synthesized; no hackathon study validates them directly.
- **Hour 0–3 (Oct 8): kickoff contract session, all three people.**
  - Write `docs/DEMO_PATH.md`, the exact 3-minute story the video will show.
  - Write `contracts/`: the API endpoints between frontend and agent backend, the GeoJSON/feature schema between data scripts and frontend, and the data file paths and formats.
  - Set up `CLAUDE.md` (short) and `DECISIONS.md`.
  - Scaffold the repo directories once.
  - Write `make smoke`.
- **Walking skeleton by the end of day 1.** A thin vertical path: the map shows one real or fixture layer from the data scripts, a click calls the backend, and the backend returns a stub complaint draft. After that, every workstream replaces stubs behind a stable contract.
- **Integration checkpoints every ~3–4 waking hours, and at meals.** Each person merges their green PRs. Run `make smoke` on main and do a 5-minute stand-up:
  - what merged,
  - what decisions agents made (read the new DECISIONS.md lines),
  - whether any contract changes are pending,
  - which mocks are still in place.
- **Daily integration lead.** One person each day owns main's health, contract merges and the evening demo run. Rotate the role, or give it to the person whose area is in the middle (the backend).
- **Decision protocol.**
  - Inside one area: the owner decides, and their agent logs the decision.
  - A change to a contract: whoever proposes it writes a short entry in DECISIONS.md plus a PR touching `contracts/`. Both affected owners approve, and the integration lead merges.
  - Ties: the integration lead decides in under 10 minutes, choosing the option that is better for the demo path.
- **End-of-day ritual (about 30 minutes).**
  - Merge or park all work.
  - Run the demo path end to end, and record a rough screen capture as a video backup.
  - Prune or extend CLAUDE.md.
  - Queue read-only overnight agents (research, a review of main, a writeup draft from DECISIONS.md) that report to files and don't push.
- **Freeze.**
  - Feature freeze around the evening of day 3 (Oct 10).
  - Day 4 (Oct 11) is for bug fixes on the demo path, the video, the README and the writeup.
  - DECISIONS.md and the agent session summaries are raw material for the writeup.

### Gaps
- I found no published hackathon post-mortems from teams of several people who each ran several agents. The one relevant post-mortem was a solo developer at Anthropic's Opus 4.7 hackathon.
- A search result mentioned a hackathon write-up reporting about 30 minutes of sequential work done in about 10–15 minutes by 3 parallel sessions with per-folder ownership. I couldn't confirm its source URL, so treat that as unverified.
- The 3–4 hour integration cadence is a judgment call based on the small-batch and CI evidence, not a measured finding.

## 6. Concrete operating model for Saboot (3 people, about 3.5 days, Claude Code)

### Takeaway
Use **"one human, one area, one writer"**:
- Each person owns a workstream and runs one main writing session in it at a time.
- Each person adds 1–2 read-only or verification side sessions, and at most one extra low-risk writing session in a separate worktree on disjoint files.
- Coherence comes from files in the repo, not from chat history: the demo path, contracts, the decisions log, the per-area plan, and a short CLAUDE.md.
- Speed comes from isolation (worktrees) and from automated checks.

### Cited Findings
These are the evidence anchors behind each rule below.
- **Single writer per area, intelligence in parallel.** — [Cognition 2026](https://cognition.com/blog/multi-agents-working)
- **Teammates own different files; start with 3–5 agents; 5–6 tasks each; self-contained deliverables.** — [agent teams](https://code.claude.com/docs/en/agent-teams)
- **Each person can review and land one significant change at a time; parallelize research, questions, chores and pre-specified work.** — [Willison](https://simonwillison.net/2025/Oct/5/parallel-coding-agents/)
- **Worktree or checkout per session; 4–5 agents per engineer at incident.io; about 5 local sessions for Cherny; one at a time for Hashimoto.** — [incident.io](https://incident.io/blog/shipping-faster-with-claude-code-and-git-worktrees); [InfoQ](https://www.infoq.com/news/2026/01/claude-code-creator-workflow/); [Hashimoto](https://mitchellh.com/writing/my-ai-adoption-journey)
- **Explore, plan, code, commit; a spec in a fresh session; verification gates; evidence over assertions; a fresh-context reviewer limited to correctness; `/clear` after two failed corrections; hooks for must-always rules.** — [Claude Code best practices](https://code.claude.com/docs/en/best-practices)
- **Lock or claim files, progress files, a near-perfect verifier, CI gating, no single shared giant task.** — [C compiler](https://www.anthropic.com/engineering/building-c-compiler)
- **Shared CLAUDE.md updated from mistakes; formatter hook; `/commit-push-pr` command.** — [InfoQ](https://www.infoq.com/news/2026/01/claude-code-creator-workflow/)
- **The agent picks the next unmarked test from a plan file; watch for deleted tests.** — [Kent Beck summary](https://www.kentbeck.com/summaries/augmented-coding-beyond-the-vibes/)
- **spec.md, prompt_plan.md and todo.md for state across sessions.** — [Harper Reed](https://harper.blog/2025/02/16/my-llm-codegen-workflow-atm/)
- **Structural conflicts (add/add, modify/delete) dominate the costly conflicts.** — [arXiv 2607.04697](https://arxiv.org/abs/2607.04697)
- **Over-engineered process and parallel-worktree chaos sank a solo hackathon entry.** — [Muxin Li](https://humaninference.substack.com/p/why-i-didnt-win-the-opus-47-hackathon)
- **Agent teams are experimental, and split panes don't work in Windows Terminal or the VS Code terminal.** — [agent teams](https://code.claude.com/docs/en/agent-teams)

### Inferences
This is the proposed operating model, synthesized from the evidence above. Adjust the names to the team's actual skills.

**Roles**
- **Workstream owners.** The suggested split follows the stated workstreams; reassign by skill.
  - Frontend owner: `frontend/` (React and MapLibre).
  - Geodata owner: `data/` (Sentinel-2 and FIRMS ingestion, embeddings, emitting GeoJSON or tiles to the contract).
  - Agent-backend owner: `agent/` (Strands on Bedrock, legal-rule retrieval, complaint drafting, the HTTP API).
- **Each owner:**
  - is the only human who approves merges in their directory,
  - decides on internals in that directory,
  - keeps `docs/plans/<area>.md`, a todo list with checkboxes.
- **Daily integration lead (rotating, or the backend owner).**
  - Owns main's health, `contracts/`, `make smoke`, the checkpoint stand-ups, and the evening demo run.
  - From day 3, also owns the video and writeup checklist.
- **Shared, root-owned files** (only the integration lead edits them, and only via PR):
  - `CLAUDE.md`
  - `contracts/*`
  - `docs/DEMO_PATH.md`
  - `DECISIONS.md` (append-only, so anyone may add an entry)
  - `Makefile` / `make smoke`
  - top-level config

**Agents per person (cap: 3 active, of which 1 needs attention)**
1. **Main writer session** in the person's area worktree. It works on one issue at a time.
2. **Side session, read-only or verification.** Use it for:
   - research (for example a Strands API detail, a FIRMS endpoint, MapLibre layer styling),
   - "how does X work" questions,
   - a scout run whose code is discarded,
   - a fresh-context reviewer of the main session's diff before a PR.
3. **Optional: a second writer for a small, well-specified chore** (tests, fixture data, README section, styling) in its own worktree, on files the main writer is not touching.
- **Team total:** about 6–9 sessions, of which only 3 are main writers. Don't run agent teams or Gas Town-style orchestrators, because they are experimental, token-heavy, and partly unsupported on Windows terminals.

**Task sizing**
- One issue is about 30–120 minutes of agent work. It produces one PR and touches one area.
- It has an explicit verify command, such as:
  - `pytest data/tests -k firms`,
  - `npm run build && npm run test`,
  - a Playwright or Chrome screenshot of the map,
  - `make smoke`.
- "If you could describe the diff in one sentence, skip the plan." Anything spanning several files gets plan mode first.
- Never assign "make the whole pipeline work" as a single task. Split by stage and use fixtures or oracles, as the C compiler project did with GCC.

**Lifecycle: from issue to merged PR**
1. **Issue.** A GitHub issue with:
   - the goal,
   - the area label,
   - acceptance criteria linked to DEMO_PATH,
   - the verify command,
   - "out of scope".
   The owner self-assigns it; that assignment is the claim.
2. **Worktree.** Run `claude --worktree <issue-slug>`, or `git worktree add`, on branch `<area>/<issue>`. Use a different dev-server port per worktree to avoid port collisions.
3. **Explore and plan** (plan mode). The agent reads CLAUDE.md, the relevant `contracts/`, `docs/plans/<area>.md` and the latest DECISIONS.md. It proposes a plan. The human edits it (Ctrl+G) and approves.
4. **Implement and verify.** Tests or check first where feasible. The agent runs the verify command and shows evidence: output or a screenshot.
5. **Self-review.** Run `/code-review` or a reviewer subagent against the issue's acceptance criteria. Fix only correctness and requirement gaps.
6. **Record.** The agent appends any non-obvious decision to DECISIONS.md (date, area, decision, why, impact on others) and ticks the box in the area plan.
7. **PR.** Small, rebased on main, `make smoke` green.
   - Same-area PRs: the owner merges.
   - PRs that touch `contracts/` or another area: the affected owner and the integration lead approve.
8. **After merge.** `/clear` or close the session. Start the next issue in a fresh session.

**Sync points**
- Kickoff contract session (day 1, first 2–3 hours).
- Integration checkpoints every ~3–4 hours and at meals.
- End-of-day demo run and memory pruning.
- Overnight read-only agents.
- Feature freeze on the evening of day 3.
- Day 4: polish, the video, and the writeup built from DECISIONS.md and git history.

**Rules for agents** (put these in CLAUDE.md, with hooks where possible)
- Edit only files inside your assigned area directory and its tests. A PreToolUse hook can block writes outside it.
- STOP AND ASK the human before you:
  - change anything in `contracts/`, the shared config or another area,
  - add a new dependency or service (a new AWS resource, a new Bedrock model),
  - delete or skip any test,
  - change the data schema,
  - try a third approach after two failed ones.
- Never push to main, force-push, or touch `.env` or credentials.
- Never commit AWS keys. Use the shared, documented environment variables.
- Before writing a helper, search for an existing one (`grep` or reading `lib/`).
- If you mock a cross-area dependency, use the contract's fixture. Add a `TODO(integration)` comment and an "integration debt" line in the area plan.
- Finish every task by:
  - running the verify command,
  - pasting the evidence,
  - appending decisions to DECISIONS.md,
  - updating the area plan.
- Keep CLAUDE.md short. Add a line only after a repeated mistake. Rules that must always hold become hooks, for example a formatter on PostToolUse.

**What gives the coherence of a single agent**
No single chat history spans three laptops, so a single-agent memory cannot be literally shared. Its function is replaced by four files in git that every session loads or reads at the start:
- CLAUDE.md: stable rules.
- DEMO_PATH.md: the goal.
- `contracts/`: interfaces.
- DECISIONS.md plus `docs/plans/<area>.md`: the running memory of what was done and decided.

Integration checkpoints are where the humans re-synchronize their mental models, which addresses the problem Ronacher describes.

### Gaps
- The agent caps (3 per person, 1 needing attention) and the 3–4 hour cadence are judgment calls drawn from practitioner reports, not measured optima.
- Whether `claude --worktree` and PreToolUse path-blocking hooks behave identically on Windows was not verified here.
- Claude subscription rate limits for 6–9 concurrent sessions across three accounts over 3.5 days were not researched. The team should check their plan's limits on day 1.
