# JunkSnap architecture

JunkSnap turns a phone photo of waste into verified, located, accountable evidence. Anyone in India can report; Jodhpur is the pilot city where data goes deepest. Each report is moderated, verified by a stacked ensemble of models, merged into a site, located to its ward, assembly seat and Lok Sabha seat, scored per area, and turned into cited letters to the bodies that must act.

`contracts/` is the source of truth for every data shape and route. This document explains how the pieces fit; it never redefines a contract.

## 1. Who is involved

| Actor | Role |
|---|---|
| Reporter | Snaps a photo or runs Scan mode |
| Community verifier | Confirms or rejects uncertain reports; adds "me too" and cleanup photos |
| Moderator (team) | Settles disputes |
| Local body head | Receives letters; legally responsible for waste (74th Amendment) |
| Councillor, MLA, MP | Copied "for attention" |
| State pollution board | Receives letters on burning, contaminated water and construction dust |

## 2. System

```mermaid
flowchart TB
  phone["Phone web app on Amplify<br/>Snap, Scan, map, community, area pages"]
  api["API: Lambda Function URLs<br/>presign, reports, sites, votes, scores, letters"]
  s3p[("S3 private<br/>originals, KMS")]
  s3b[("S3 public<br/>blurred copies")]
  q["SQS + dead-letter queue"]
  sfn["Step Functions Express<br/>report pipeline"]
  ddb[("DynamoDB<br/>reports, sites, votes, devices, scores")]
  rek["Rekognition"]
  brk["Bedrock<br/>default LLM, VLM, embeddings"]
  orr["OpenRouter<br/>fallback and benchmark, blurred images only"]
  loc["Amazon Location<br/>reverse geocoding"]
  sm["Secrets Manager"]
  phone -->|presigned PUT| s3p
  phone --> api
  api --> q --> sfn
  sfn --> rek & brk & loc
  brk -.->|fallback| orr
  sfn --> s3b & ddb
  api --> ddb
  sm -.->|keys| sfn
```

## 3. Report pipeline

One Step Functions execution runs per report or Scan frame.

| Step | Package | Entry class | Output contract |
|---|---|---|---|
| 1. Moderate | pipeline | `ModerationService` | `moderation_result` |
| 2. Authenticate | pipeline | `AuthenticityService` | part of `moderation_result` |
| 3. Signals, in parallel | agent | `RekognitionSignal`, `YoloSignal`, `EmbeddingSignal` | signal scores |
| 4. Judge, unresolved cases only | agent | `VisionJudge` via `ProviderRouter` | judge verdict |
| 5. Decide | agent | `MetaLearner` inside `StackedVerifier` | `verification_result` |
| 6. Brands | agent | `BrandLabeller` | `brand_label[]` |
| 7. Locate | pipeline | `LocationService` | `location_lookup` |
| 8. Merge | pipeline | `SiteMerger` | `site` |
| 9. Score, scheduled | pipeline | `ScoreCalculator` | `ward_scores` |

Thresholds: probability 0.85 or more is auto-verified, 0.5 to 0.85 goes to community check, below 0.5 is rejected. Strong disagreement between signals always goes to community check. The server always re-verifies; scores from the phone are hints for live boxes and frame selection only.

## 4. Lifecycles

```mermaid
stateDiagram-v2
  [*] --> uploaded
  uploaded --> rejected: moderation or authenticity fails
  uploaded --> verifying
  verifying --> auto_verified: p at least 0.85
  verifying --> community_check: p 0.5 to 0.85, or disagreement
  verifying --> rejected: p below 0.5
  community_check --> auto_verified: confirmed by votes
  community_check --> rejected: rejected by votes
  auto_verified --> merged_into_site
  merged_into_site --> [*]
```

A site moves open → cleaned (only with an after-photo the pipeline confirms is clean) → reopened.

## 5. Edge and cloud

- Edge mode: a tiny YOLO model runs in the browser (ONNX Runtime Web) when the startup probe passes (WebGPU or WASM, under about 300 ms per frame). Confident and uncertain frames are uploaded; confident-empty frames are skipped except 1 in 20, kept for recall audits.
- Cloud mode: one downscaled frame per second is uploaded.
- An offline queue in IndexedDB retries with backoff.

## 6. Model-agnostic LLM layer

`ProviderRouter` resolves a `TaskConfig {provider, model, fallback[]}` for each task: judge, brands, letters, text moderation. Providers implement `LlmProvider`: `BedrockProvider` (default, India inference profile) and `OpenRouterProvider` (OpenAI-compatible). Every response is validated against a schema; on failure the next provider is tried. Every call logs provider, model, version, latency and estimated cost, and the evidence pack records them.

## 7. Accountability

- `LetterRouter` picks addressees from report type and state: the local body head (To); councillor, MLA and MP (Cc "for attention"); the state pollution board for burning, water and construction dust; Swachhata and CPGRAMS nationwide; Rajasthan Sampark in Rajasthan.
- `RuleRepository` serves hashed official texts. Code picks the clauses, the model writes the prose, and `QuoteVerifier` checks every quote word for word. `TemplateLetter` is the fallback.
- Quoted rule text stays in the official English or Hindi.

## 8. Area scores

City, citizen and bin-access scores are computed per ward, assembly seat, Lok Sabha seat and district. Formulas are versioned in `docs/decisions/`. Guardrails: area level only, at least 10 verified reports before a score shows, counts always shown, a pilot flag, no invented history.

## 9. Security and privacy

- Originals sit in a private bucket under KMS and are never public. Public copies have faces and number plates blurred.
- No photos of people dumping, and no names of individuals in any text.
- OpenRouter only ever receives blurred images; Bedrock is the default for anything personal.
- Per-device tokens, rate limits, perceptual-hash duplicate checks, an India geofence and fresh timestamps.
- Secrets live in Secrets Manager; nothing secret in the repo.

## 10. Stages and deployment

Two stages: `dev` for building and `demo` for the recording, deployed only from a clean `main` when the human says so. Stacks are named `junksnap-<stage>` in ap-south-1. Amplify builds the frontend from `main`.

## 11. Failure modes

| Failure | Fallback |
|---|---|
| Bedrock throttled or unavailable | Next provider in `TaskConfig.fallback` |
| Phone cannot run the model | Cloud mode |
| No network | Offline queue |
| Letter verification fails | Template letter with the same citations |
| Pipeline step error | SQS retry, then dead-letter queue and a "needs review" status |

## 12. Roadmap (not built)

Drones and CCTV through Kinesis Video Streams, satellite history beyond large sites, packaging-type EPR analytics per area, MLA lists for more states, potholes.
