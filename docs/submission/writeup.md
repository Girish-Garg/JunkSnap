# JunkSnap: writeup

## Problem

Dumps are not only the authorities' failure. People dump on empty plots, often because there is nowhere legal to put waste.

## What it does

JunkSnap measures all three causes. Anyone in India photographs waste, or films it with GPS, in the app. The server blurs faces and number plates, verifies the photo with stacked models, merges it into a site on the map, and finds its ward, assembly seat (MLA) and Lok Sabha seat (MP). For a verified site it drafts a letter To the local body head, Cc the councillor, MLA and MP, quoting the Solid Waste Management Rules, 2026 (S.O. 388(E)) and other official texts, each quote checked word for word. Each area gets three scores: city clearing, citizen dumping and access to bins.

## Built on AWS

Amazon EKS Auto Mode runs `api`, `worker`, `ml` and a `scores` CronJob. Originals sit in a private S3 bucket under KMS; only blurred copies are public, through CloudFront. SQS with a dead-letter queue feeds the worker. DynamoDB stores reports, sites, votes and scores. Cognito handles sign-in. Rekognition finds unsafe images, faces and plates. Amazon Location gives state, district and town. Bedrock judges unsure photos, writes letters, reads brands, checks notes and extracts ward data. Amplify hosts the app.

## ML and verification

Rekognition labels, our YOLO26 detector and a SigLIP 2 embedding classifier score each blurred photo. A logistic-regression meta-learner combines them; a Bedrock vision judge runs only when signals disagree or the result is unsure. At 0.85 or more a report is auto-verified, 0.5 to 0.85 goes to a community check by neighbours, below 0.5 it is rejected; when two signals differ by 0.5 or more it always goes to the community check. On the public test split (184 photos) the meta-learner reached 0.978 accuracy with calibration error 0.019, against 0.115 for fixed weights. All numbers come from openly licensed public data. Pile and bin boxes came from an OWLv2 teacher model, so those detector numbers measure agreement with it, not with people.

## Real and pilot

Jodhpur is the pilot. Assembly seats are loaded for Rajasthan, crawled ward data for Jodhpur and Jaipur, Lok Sabha seats for all of India (three states use older shapes, and their MPs are not copied on letters). A score shows only after 10 verified reports in an area; below that only counts show. Pilot areas are flagged; no history is invented.

## Limits

- Accuracy on Jodhpur photos is not measured yet.
- Jodhpur has no open ward map, so sites show seats but no ward. Crawled ward facts and rule entries await a person's review.
- The app screens for letters and area pages are being finished; their API routes exist.
- Photos show waste, not who put it there; no person is named. Letters are drafts the resident files.

## AI tools used

- **Claude Code** (Claude Opus 5.5): coding agents and code reviews.
- **Amazon Bedrock**: Amazon Nova Lite as the vision judge; Amazon Nova Pro for letter prose, brand reading, note moderation and ward-data extraction. Claude Sonnet 4.6 and Haiku 4.5 are configured first but blocked for this account until Anthropic's use-case form is submitted. Nova 2 Lite and Titan embeddings were only benchmarked.
- **Amazon Rekognition**: moderation, faces, plates, labels, packaging text.
- **OWLv2**: offline teacher boxes for piles and bins.
- **Ultralytics YOLO26** (AGPL-3.0): the waste detector.
- **SigLIP 2**: embeddings for the classifier and site merging.
- **OpenAI API** (gpt-4.1-mini): configured as the last fallback for the judge and letters; it produced no result reported here.
