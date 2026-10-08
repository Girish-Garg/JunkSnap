# Saboot (सबूत)

**Pin it. Prove it. Track it.**

Saboot turns a map pin on an illegal dump or waste-burning site into a complaint backed by satellite evidence and the exact rule that applies.

1. **Pin.** A resident marks the spot and can add a photo.
2. **Prove.** The app shows dated Sentinel-2 images of the spot and NASA FIRMS fire detections near it.
3. **Draft.** An AI agent retrieves the applicable clause of the Solid Waste Management Rules, 2026 (S.O. 388(E), in force from 1 April 2026) and the responsible authority, then writes a one-page complaint in Hindi or English. Every cited rule is shown next to its source.
4. **Track.** The resident files the complaint and Saboot follows it up.

Pilot district: Jodhpur, Rajasthan.

Built for Environmental Hacks (Bharat Builds Tour by WeMakeDevs and AWS), 8 to 11 October 2026, Waste and Energy track.

Team: Hemang, Girish, Harshit.

## Status

Work started 8 October 2026. No code yet.

## How we work

Three people (or two) each run up to three AI coding sessions. Every session follows [AGENTS.md](AGENTS.md):

- **Lanes** own folders (`fe`, `data`, `agent`, `infra`, `contract`, `lead`), and [.claude/roster.json](.claude/roster.json) says who holds each one.
- **Worktrees:** every writing session runs in its own worktree named after its lane, e.g. `claude -w fe-12-legend`.
- **Contracts** in [contracts/](contracts/) are the only interface between lanes.
- **Shared memory:** decisions are one file each in [docs/decisions/](docs/decisions/), and each person keeps a short [status file](docs/status/).
- **Guardrails:** a session-start brief, a scope guard and permission rules in [.claude/](.claude/), plus CI in [.github/workflows/ci.yml](.github/workflows/ci.yml).

New laptop? Follow [docs/setup.md](docs/setup.md).

## Docs

- [Research report: verdict, build plan, video script](<docs/Saboot hackathon idea evaluation.md>)
- [Team workflow: parallel coding agents without conflicts](<docs/Parallel coding agents team workflow.md>)
- [Synopsis](docs/synopsis/Saboot_Synopsis.pdf)
- Research notes:
  - [Hackathon judging and how to win](docs/research/hackathon_judging_and_winning.md)
  - [Waste rules and complaint channels](docs/research/india_regulatory_grievance.md)
  - [Satellite data feasibility](docs/research/satellite_data_feasibility.md)
  - [AWS architecture and build plan](docs/research/aws_architecture_build_plan.md)
  - [Competitors and improvements](docs/research/competitors_and_improvements.md)

## Limits

- Satellite images show that a site exists and when it changed. They do not show who is responsible, so drafts describe a location and never name a person.
- The draft is not legal advice. The resident files it, and nothing is submitted automatically.
