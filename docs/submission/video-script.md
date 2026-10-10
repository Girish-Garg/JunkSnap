# JunkSnap: video script (2:56)

Hard limit 3:00; this cut ends at 2:56, a 4 s margin. Record the deployed app on a phone (screen recording of the Android app, or of https://demo.d3iec0rb3f75jm.amplifyapp.com in the phone's browser) plus the AWS console on a laptop, signed in to `ap-south-1`. The voice-over is 387 words, about 2:40 at a calm 145 words a minute, which leaves room for the shots.

## Before recording

- One Jodhpur site verified by 10 people from the field audit (10 photos or yes votes). A site letter needs `verification: verified`; the route answers 409 `not_verified` otherwise.
- One Jodhpur area (assembly seat or district) with 10 or more verified reports for one issue, for the area letter and a shown score. If none has 10 yet, film the "Not enough reports yet" line instead; never fake a score.
- A no-bin zone in Jodhpur, even if it shows fewer than 10 of 10.
- A fresh Snap of a real Jodhpur dump, taken in the shot, on a phone where the live boxes appear.
- The app signed in, English, light theme (switch to dark for one second in shot 9 if time allows). Install the APK from the GitHub Release `app-v0.1.0` if you record the Android app; it is a debug-signed prerelease.
- AWS console tabs open in this order: EKS, DynamoDB, S3, Bedrock, Rekognition, CloudFront, Cognito, Amplify. No account id, email or key on screen; crop or blur if needed.
- No face or number plate in any raw footage that is not blurred by the app. Do not film anyone dumping. No person's name on screen; representatives appear by office and seat only.

## Shot list

| # | Time | Shot | Voice-over |
|---|---|---|---|
| 1 | 0:00 to 0:11 | Handheld footage of a real dump on an empty plot in Jodhpur. Slow pan, no people in frame. | "This is an empty plot in Jodhpur. Everyone blames the city. But people dump here too, often because there is nowhere legal to put waste." |
| 2 | 0:11 to 0:22 | Phone: the app opens with the cartoon camera logo splash (about 1 s), then the "How JunkSnap works" cards, swiped slowly through two of them. Text on screen: "Measures all three causes: city, citizens, bins." | "JunkSnap measures all three causes: how fast the city clears dumps, how much people dump, and whether there is a bin at all." |
| 3 | 0:22 to 0:42 | Phone: map over Jodhpur, tap the yellow Report button. Live camera with boxes drawn around the waste. Take the photo, pick "Waste dump" and "Vacant plot", tap "Send report". Progress steps tick, confetti. | "Anyone can report, only through the in-app camera, with GPS. On phones that pass a speed check, a small detector draws live boxes as you shoot. The photo goes straight to a private S3 bucket encrypted with KMS, and waits on the phone if the network drops." |
| 4 | 0:42 to 0:51 | Phone: Activity, then the report's blurred photo in the full-screen viewer. Zoom on a blurred face or plate if one is in frame. Text on screen: "Faces and number plates are blurred." | "Before any public copy exists, Rekognition finds faces and number plates and we blur them. The original never becomes public." |
| 5 | 0:51 to 1:12 | Laptop: DynamoDB console, `junksnap-demo-reports` table, open the report item. Expand `verification_result`: probability, each signal with its model and version, and `insights` (materials, size class, hazards). Optional overlay: "meta-learner accuracy 0.978, calibration error 0.019, public test data" from `docs/ml/eval.md`. | "On EKS, three models check the blurred photo: Rekognition labels, our YOLO26 detector and a SigLIP 2 classifier. A meta-learner combines them; only when they disagree or are unsure does a vision model on Bedrock judge. Every decision records which model made it, and what the waste is made of." |
| 6 | 1:12 to 1:32 | Phone: tap the new site's hollow pin: "1 of 10" and the progress bar. Then the verified site: photo strip, "10 of 10 people confirmed", the residents' notes summary, and the Location block: local body, ward line, assembly seat (MLA), Lok Sabha seat (MP). | "The models only let a photo through. People verify: a site counts once ten different people back it with a photo or a yes. Residents add notes, and Bedrock summarises them. Amazon Location and our seat maps place the site: local body, MLA's seat and MP's seat." |
| 7 | 1:32 to 1:42 | Phone: Report, "There is no dustbin within 1 km of here", send. Map zooms out to the zone's 1 km circle with its count. | "You cannot photograph a missing bin. So people report no dustbin within a kilometre, and ten of them verify a zone." |
| 8 | 1:42 to 2:07 | Phone: on the verified site tap "Draft letter". To the Commissioner of the local body, Cc MLA and MP "for attention". Scroll to a citation card quoting the Solid Waste Management Rules, 2026, S.O. 388(E), and to the evidence with the residents' line. Hold on "N of N quotes verified word for word". Then the area page: pick an issue for an area letter to the same offices. Tap print; the PDF preview appears. | "For a verified site, or one issue across a whole area, JunkSnap drafts a letter to the body that must act, copied to the representatives, with evidence. Code picks rules from official texts we hashed, Bedrock writes the prose, and a verifier checks every quote word for word. Nothing is sent automatically. The resident files it." |
| 9 | 2:07 to 2:23 | Phone: Areas map, assembly seats in Rajasthan and Lok Sabha seats beyond the border, a marker in each area. Open the Jodhpur seat: counts, pilot flag, scores with diagnosis or "Not enough reports yet". Tap the ranking. | "Each area gets three scores, city, citizen and bin access, and a diagnosis. A score shows only after ten verified reports. Counts always show, the pilot is flagged, and we never invent history." |
| 10 | 2:23 to 2:43 | Laptop montage, about 2 s each: EKS cluster `junksnap` with the `api`, `worker`, `ml` pods and the `scores` and `crawler` CronJobs; DynamoDB tables; S3 buckets (originals with KMS, blurred copies); Bedrock model catalog (Nova Lite, Nova Pro); Rekognition; CloudFront; Cognito; Amplify. | "All of it runs on AWS in Mumbai: EKS for the services and the ward crawler, SQS and DynamoDB for the pipeline, S3 with KMS for photos, Rekognition and Bedrock for the models, CloudFront, Cognito and Amplify for the app." |
| 11 | 2:43 to 2:56 | Back to the Jodhpur plot, then end card: "JunkSnap", the web URL, "Android app on GitHub Releases", the repo URL `github.com/Girish-Garg/saboot`, "Hemang, Girish, Harshit". | "Dumps are not only the authorities' failure. JunkSnap shows which cause it is, and who must act. Snap the junk. Prove it. Get it cleared." |

## Notes

- Keep every number on screen from `docs/ml/eval.md`; say "on public test data" if a number is shown.
- If a shot runs long, cut the optional overlay in shot 5 first, then shot 7, then shorten the montage in shot 10 to 1.5 s per service. AWS must stay visible.
- Check the final cut is 2:56 or less, and that the YouTube link opens in a signed-out browser.
