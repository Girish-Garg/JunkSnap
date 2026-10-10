---
status: proposed
superseded_by:
area: infra
by: hem
date: 2026-10-10T04:01+05:30
---
# Server image carries data/ at /app/data; dev web app is a hand-deployed Amplify app

Context: location, moderation, brands, letters and scores read files from `data/` through `ASSETS_DIR`. The pods had none. Issue #54 also needs the web app hosted on dev without a GitHub connection.

Decision:
- `scripts/deploy.py` builds `junksnap-server` with the named build context `data=data`. The Dockerfile copies `boundaries`, `representatives`, `rules`, `brands` and `wards` (when present) to `/app/data` and sets `ASSETS_DIR=/app/data`, about 2.5 MB. No copy step before `docker build`.
- Dev web app: Amplify Hosting app `junksnap-dev-web`, branch `dev`, deployed by hand with `scripts/deploy_web.py` (create-deployment, zip upload, start-deployment), built in live mode against the stage's CloudFront URL and Cognito ids. Then `deploy.py dev --origins <amplify url>,http://localhost:5173` sets the api CORS.

Consequences for other lanes: a new data folder the server reads needs one `COPY --from=data` line. Frontend changes reach dev only when someone reruns `deploy_web.py dev`.

Rejected alternatives: copying data into `backend/server/assets` before each build (an extra step that is easy to forget); Amplify connected to GitHub (needs repo access for the AWS app).
