# JunkSnap: writeup

## Problem

Dumps are not only the authorities' failure. People dump on empty plots, often because there is nowhere legal to put waste.

## What it does

JunkSnap measures all three causes. Anyone in India photographs waste, or films it with GPS, in the app; on capable phones a small detector draws live boxes as they shoot. Report types cover waste dumps, overflowing or broken bins, contaminated water, open construction and missing bins. The server blurs faces and number plates, checks each photo with stacked models, and puts it on the map as a site from the first passed photo. A site is verified when 10 different people back it with a photo or a yes vote. A missing dustbin cannot be photographed, so people report "no dustbin within 1 km" from where they stand, and those reports form community zones, verified the same way. Residents can add notes to a site, which Bedrock summarises.

Each site gets its ward, assembly seat (MLA) and Lok Sabha seat (MP). For a verified site, or for one issue across a whole ward, seat or district, JunkSnap drafts a letter To the local body head (for Lok Sabha seats and districts, the District Collector first and the local body heads too), Cc the councillor, MLA and MP for attention. Letters quote the Solid Waste Management Rules, 2026 (S.O. 388(E), 27 January 2026, in force 1 April 2026) and other official texts, each quote checked word for word, and carry evidence: counts, reporters, dates, blurred photos and a line on what residents noted. Each area gets three scores: city clearing, citizen dumping and access to bins. The Areas map shows assembly seats in Rajasthan and Lok Sabha seats elsewhere, with a ranking of the worst areas.

The app has a playful look with a cartoon logo, onboarding cards and dark mode, and runs on the web and as an Android app.

## Built on AWS

Amazon EKS Auto Mode runs `api`, `worker`, `ml`, a `scores` CronJob and an hourly ward-crawler CronJob. Originals sit in a private S3 bucket under KMS; only blurred copies are public, through CloudFront. SQS with a dead-letter queue feeds the worker. DynamoDB stores reports, sites, votes, scores and crawls. ECR holds three images. Cognito handles sign-in. Rekognition finds unsafe images, faces and plates. Amazon Location gives state, district and town. Bedrock judges unsure photos, writes letters, summarises residents' notes, reads brands, checks notes and extracts ward data. Amplify hosts the web app: https://demo.d3iec0rb3f75jm.amplifyapp.com. The Android APK is a GitHub Release (tag `app-v0.1.0`) built by GitHub Actions; it is a debug-signed prerelease until the release key is added.

## ML and verification

Rekognition labels, our YOLO26 detector and a SigLIP 2 embedding classifier score each blurred photo. A logistic-regression meta-learner combines them; a Bedrock vision judge runs only when signals disagree or the result is unsure. The models gate each photo: under 0.5 it is rejected, otherwise it joins a site, and people verify the site. On the public test split (184 photos) the meta-learner reached 0.978 accuracy with calibration error 0.019, against 0.115 for fixed weights. A smaller YOLO26n runs on the phone as a 2.8 MB int8 ONNX file for live boxes only; the server always re-verifies. All models are trained and evaluated on openly licensed public data only. Pile and bin boxes came from an OWLv2 teacher model, so those detector numbers measure agreement with it, not with people.

## Real and pilot

Jodhpur is the pilot. Assembly seats are loaded for Rajasthan, crawled ward data for Jodhpur and Jaipur, Lok Sabha seats for all of India (Assam, Jammu and Kashmir and Ladakh use older shapes, and their MPs are not copied on letters). A score shows only after 10 verified reports in an area; below that only counts show. Pilot areas are flagged; no history is invented.

## Limits

- Accuracy on Jodhpur photos is not measured; the judge prompt changed after its evaluation.
- Jodhpur has no open ward map. Approximate ward boundaries for 34 of Jodhpur's 100 wards and 12 of Jaipur's 150 are built as unreviewed data files (`data/boundaries/*_wards.geojson`); they are not on the map and not used for lookups, scores or letters. Crawled ward facts and rule entries await a person's review.
- Photos show waste, not who put it there; no person is named. Letters are drafts the resident files.

## AI tools used

- **Claude Code** (Claude Opus 5.5 for planning and coding agents; Claude Sonnet 5.5 for the fresh-context reviewer subagent).
- **Amazon Bedrock**: Amazon Nova Lite as the vision judge; Amazon Nova Pro for letter prose, summaries of residents' notes, brand reading and note moderation; Nova Pro, then Nova Lite, for ward-data extraction. Claude Sonnet 4.6 and Haiku 4.5 are configured first but blocked for this account until Anthropic's use-case form is submitted. Nova 2 Lite and Titan embeddings were only benchmarked.
- **Amazon Rekognition**: moderation, faces, plates, labels, packaging text.
- **OWLv2**: offline teacher boxes for piles and bins.
- **Ultralytics YOLO26** (AGPL-3.0): the waste detector on the server (YOLO26s) and on the phone (YOLO26n, run with ONNX Runtime Web).
- **SigLIP 2**: embeddings for the classifier and site merging.
- **OpenAI API** (gpt-4.1-mini): configured as the last fallback for the judge and letters; it produced no result reported here.

## Team

Hemang, Girish, Harshit. Code: https://github.com/Girish-Garg/saboot (AGPL-3.0).
