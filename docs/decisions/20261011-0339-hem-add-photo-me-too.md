---
status: accepted
superseded_by:
area: frontend
by: hem
date: 2026-10-11T03:39+05:30
---
# Add a photo to a site reuses me_too_site_id, and a different reporter's photo adds a corroboration

Context: the human asked for a way to add more photos to one site (fe-129). `report_upload.me_too_site_id` already exists, and the merge picker ranks that site first while still checking distance and the image embedding.

Decision:
- "Add a photo" on an open site (site sheet and pin card) opens Snap at `/snap?site=<id>`, preset to the site's `report_type` and `context`, and sends `me_too_site_id`. No contract change.
- The photo's own fix decides the place. Within 40 m (the merge radius) it is sent as it is. Farther, it gets the site's point as a long-range `target`, up to 300 m, or 490 m when the reporter ticks "I'm up high", which is 10 m inside the api's 500 m cap (decision 20261011-0400). Past that, Send is off. A `no_bin` zone allows 40 m and never a target.
- A photo from a person who has not reported the site yet adds a corroboration (`me_too_count`, as `SiteAddition` already counts it) and joins `photo_urls` once it passes the checks. The app says it "may join", since the merge can still found a new site.
- The app shows the action but mutes it, with the reason, for a closed site or when the person is clearly too far. Signed out, a tap opens sign-in. Until fe-124's shared model lands, a local `AddPhotoGate` decides this.

Consequences for other lanes: none for the api. fe-124 folds `AddPhotoGate` into `SITE_GATES.addPhoto`.

Rejected alternatives: a separate "add photo" route on the api (duplicates intake); gallery upload (capture is in-app camera only).
