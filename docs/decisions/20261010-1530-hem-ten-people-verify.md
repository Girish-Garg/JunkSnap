---
status: accepted
superseded_by:
area: contracts
by: hem
date: 2026-10-10T15:30+05:30
---
# Ten different people verify a site; the models only gate each photo

Context: a high-confidence model result verified a site on its own, and ±3 weighted votes settled the rest. Ten sources are a clearer public bar. Set by the lead on 10 Oct.

Decision:
- A site appears from its first photo the models pass (moderation passed, ml decision not `rejected`) as `unverified`, shown "1 of 10".
- A person is a user id, else a device token, and counts once. They back a site with a model-passed photo of it or a confirm vote (latest vote). `site.backers`: `count`, `needed` 10, `photo_people`, `vote_people`. At 10 the site is `verified`.
- Safety valve: distinct no voters (with no photo of it) exceeding `backers.count` by 3 or more makes it `rejected` and hidden. Verified and rejected are final. Votes carry no weight.
- Reports follow their site (`unverified`, `verified`, `rejected`); `verified_count` is every report of a verified site; scores count only those. The 10-verified-report area rule and site letters needing a verified site stay.
- Existing sites are migrated: backers recomputed from stored reports and votes, verification recomputed from them.

Supersedes: 20261010-0253-hem-verified-count, and the auto-verify and ±3 community-check parts of 20261010-0115.

Consequences for other lanes: the frontend shows unverified pins hollow with an n/10 badge, a progress bar and Yes/No for anyone who has not backed it; ml is unchanged.

Rejected alternatives: keeping auto-verify for very confident photos; weighting votes by reputation.
