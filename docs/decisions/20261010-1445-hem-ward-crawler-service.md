---
status: proposed
superseded_by:
area: data
by: hem
date: 2026-10-10T14:45+05:30
---
# The ward crawler runs as an hourly CronJob over a crawls table, cached in S3 crawl/

Context: the crawler ran only by hand and kept pages on one laptop. Areas become active when people report there, so the crawl must follow the reports, never refetch or re-ask a model for an unchanged page, and tell people when ward data is coming (issue 78).

Decision: a DynamoDB table `crawls` (key `district_id`) instead of an SQS queue: the worker queues a district (conditional updates) when it settles the district's `CRAWL_ACTIVATE_AFTER`-th verified report (default 1); the hourly `crawler` CronJob (image `junksnap-crawler`, Pod Identity role `junksnap-<stage>-crawler`) crawls queued rows, rows whose `next_due_at` passed (every `CRAWL_INTERVAL_DAYS`, 30; failed ones after `CRAWL_RETRY_HOURS`, 6) and rows left running over 3 h. A district with no `sources/<city>.json` (matched by the server's `<state>-<district>` id rule) becomes `no_sources`; sources are never invented. Pages (bytes, text, SHA-256, headers), extractions (keyed by prompt version, model chain and chunk) and map layers live under `crawl/` in the originals bucket; a page is revalidated with ETag or hash, and the cached copy is used when the host is down. Output goes to `crawl/wards/<city>.json`; worker and scores read the newer of it and the image's `data/wards/<city>.json`. The CronJob extracts with Nova Pro, then Nova Lite (`CRAWL_MODELS`). `GET /areas/district/{id}/crawl` (`area_crawl`) feeds one app banner.

Consequences for other lanes: contracts v1.4 rows; infra adds the table, ECR repo, role and CronJob; the worker picks up new crawl output only on restart; reviewed records must stay in git, since a newer unreviewed crawl file wins for its city.

Rejected alternatives: an SQS `crawl` queue (a consumer, a DLQ and a schedule store for one message a month); reusing the `junksnap-ml` repository with a tag (two images under one kustomize name).
