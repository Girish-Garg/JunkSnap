# Contracts

The interfaces between lanes. Written at the kickoff contract session and merged as PR #1, before any feature work. After that, change them only in a `contract-` worktree, in a PR that touches only `contracts/`, with a decision file and approval from every affected holder. Announce every change in team chat.

## Files

- `schemas/<name>.schema.json`: JSON Schema (draft 2020-12) for each shape that crosses a lane boundary.
- `fixtures/<name>.<site>.json`: one valid example per schema for each seed site. The frontend's mock mode and every lane's tests use these.
- CI runs `uv run scripts/validate_contracts.py`, which checks every fixture against its schema and that every schema has a fixture.

| Schema | Owner lane | Used by |
|---|---|---|
| `draft_request`, `draft_response` (citations carry source URI, page and hash), `case_item` | agent | fe |
| `site` (GeoJSON feature properties), `timeline`, `firms` | data | fe, agent |

## Routes

To be filled at kickoff: method, path, request schema, response schema, and which Lambda serves each one.

## Environment variables

`VITE_API_URL`, `VITE_API_MODE` (`mock` or `live`), `KB_ID`, `SABOOT_STAGE` (set on deployed Lambdas), `FIRMS_MAP_KEY`.

## Stages and names

Stages: `hem`, `gir`, `har`, `demo`. Stacks `saboot-<stage>`. DynamoDB `saboot-<stage>-cases`. S3 `s3://saboot-data-<account-id>/<stage>/...`.

## DynamoDB tables and keys

To be filled at kickoff.

## S3 key layout

To be filled at kickoff.

## Seed sites

To be filled at kickoff: three seed sites (Keru dumping yard, the corporation's yard behind Central Jail, and a third), plus negatives (quarry waste, a brick kiln, bare desert). Use their short ids in fixture names.

## Shared wording

- "thermal anomalies recorded near this location" (never "fires detected")
- "candidate sites" (never "dumps found")
