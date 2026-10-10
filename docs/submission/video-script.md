# JunkSnap: video script (3:00)

Hard limit 3:00. Record on the deployed web app on a phone (screen recording) plus the AWS console on a laptop, signed in to `ap-south-1`. The voice-over is about 380 words, roughly 2:40 at a calm pace, which leaves room for the shots.

**Marked [#71]:** these shots need the letter view and the area page that issue #71 is building. If #71 is not merged in time, use the fallback written under the shot.

## Before recording

- One verified site in Jodhpur (auto-verified, or confirmed by neighbours' votes). A letter needs `verification: verified`; the route answers 409 `not_verified` otherwise.
- A fresh Snap of a real Jodhpur dump, taken in the shot, that ends in a result you can show.
- The phone already signed in, language set to English (switch to Hindi for one second in shot 8 if time allows).
- AWS console tabs open in this order: EKS, DynamoDB, S3, Bedrock, Rekognition, CloudFront, Cognito. No account id, email or key on screen; crop or blur if needed.
- No face or number plate in any raw footage that is not blurred by the app. Do not film anyone dumping.

## Shot list

| # | Time | Shot | Voice-over |
|---|---|---|---|
| 1 | 0:00 to 0:12 | Handheld footage of a real dump on an empty plot in Jodhpur. Slow pan, no people in frame. | "This is an empty plot in Jodhpur. Everyone blames the city. But people dump here too, often because there is nowhere legal to put waste." |
| 2 | 0:12 to 0:22 | Title card: "JunkSnap. Snap the junk. Prove it. Get it cleared." Under it: "Measures all three causes: city, citizens, bins." | "JunkSnap measures all three causes: how fast the city clears dumps, how much people dump, and whether there is a bin at all." |
| 3 | 0:22 to 0:42 | Phone: open the app on the map over Jodhpur. Tap the camera button. Live camera, GPS line shows "Location ±N m". Take the photo. Pick "Waste dump" and "Vacant plot". Tap "Send report". Progress steps tick: saved, uploaded, sent, checked. | "Anyone can report. The photo comes only from the in-app camera, with GPS. It goes straight to a private S3 bucket encrypted with KMS. If the network drops, it waits on the phone and retries." |
| 4 | 0:42 to 0:52 | Phone: Activity, then the report's blurred photo. Zoom on a blurred face or plate if one is in frame. Text on screen: "Faces and number plates are blurred." | "Before any public copy exists, Rekognition finds faces and number plates and we blur them. The original never becomes public." |
| 5 | 0:52 to 1:15 | Laptop: DynamoDB console, `junksnap-dev-reports` table, open the report item. Expand `verification_result`: decision, probability, each signal with its model and version, and `insights` (materials, size class, hazards). Optional overlay: the stack table from `docs/ml/eval.md` (accuracy 0.978, ECE 0.019). | "Then three models check it: Rekognition labels, our YOLO26 detector and a SigLIP 2 classifier. A meta-learner combines them into one probability. Only when they disagree does a vision model on Bedrock act as judge. Above 0.85 the report is verified; in between, or when two models strongly disagree, neighbours vote. Every decision records which model made it, and what the waste is made of." |
| 6 | 1:15 to 1:35 | Phone: map, tap the site marker. Site sheet: blurred photos, status, report counts, "Pilot city", then the Location block: local body, ward (or "No open ward map"), assembly seat (MLA), Lok Sabha seat (MP). | "Reports at the same spot merge into one site. Amazon Location and our seat maps place it: the local body, the ward where an open map exists, the MLA's seat and the MP's seat." |
| 7 | 1:35 to 2:05 | **[#71]** Phone: on the verified site tap "Draft letter". Letter view: To the Commissioner of the local body, Cc MLA and MP "for attention", subject, body. Scroll to a citation card quoting the Solid Waste Management Rules, 2026, S.O. 388(E), with its hash. Hold on the verifier line "N of N quotes verified". Tap print; the PDF preview appears. *Fallback:* terminal running `POST /sites/{id}/letters` against the API, showing `to`, `cc`, the citations and `verifier.verified` equal to `verifier.total`. | "For a verified site, JunkSnap drafts a letter to the body that must act, copied to the representatives. Code picks the rules from official texts we hashed; Bedrock writes the prose; then a verifier checks every quote word for word. If one fails, we fall back to a template. Nothing is sent automatically. The resident files it." |
| 8 | 2:05 to 2:25 | **[#71]** Phone: Areas tab, open the Jodhpur assembly seat or district page. Show the counts, the pilot flag, and either the three scores with the diagnosis or "Not enough reports: N of 10 verified". *Fallback:* terminal running `GET /areas/assembly/{id}/scores`, showing the counts, `pilot: true` and the withheld scores. | "Each area gets three scores, city, citizen and bin access, and a diagnosis. A score shows only after ten verified reports. Counts always show, the pilot is flagged, and we never invent history." |
| 9 | 2:25 to 2:48 | Laptop montage, about 3 s each: EKS cluster `junksnap` with the `api`, `worker`, `ml` pods and the `scores` CronJob; DynamoDB tables list; S3 buckets (originals with KMS encryption, public blurred); Bedrock model catalog (Nova Lite, Nova Pro); Rekognition; CloudFront distribution; Cognito user pool. | "All of it runs on AWS in Mumbai: EKS for the services, SQS and DynamoDB for the pipeline, S3 with KMS for photos, Rekognition and Bedrock for the models, CloudFront, Cognito and Amplify for the app." |
| 10 | 2:48 to 3:00 | Back to the Jodhpur plot, then end card: "JunkSnap", the repo URL `github.com/Girish-Garg/saboot`, "Hemang, Girish, Harshit". | "Dumps are not only the authorities' failure. JunkSnap shows which cause it is, and who must act. Snap the junk. Prove it. Get it cleared." |

## Notes

- Keep every number on screen from `docs/ml/eval.md`; say "on public test data" if a number is shown.
- Do not name any person in the letter or on screen. Representatives appear by office and seat only.
- If a shot runs long, cut the optional overlay in shot 5 first, then shorten the montage in shot 9 to 2 s per service. AWS must stay visible.
- Check the final cut is 3:00 or less, and that the YouTube link opens in a signed-out browser.
