# Model evaluation (A2, issue 50)

All numbers are measured on the **public test split** (hash split, seed 26; nothing here was trained on it). Models are trained and evaluated on openly licensed public data only; field photos are never imported, labelled for training or held out (decisions 20261010-1030 and 20261010-1245-hem-ml-public-data-only). Measured on 10 Oct 2026.

**Boxes made by a model, not by people:** every `waste_pile` and `bin` box comes from an OWLv2 teacher (`google/owlv2-large-patch14-ensemble`, Apache-2.0) run on the QR4Change photos; for those two classes the detector table measures agreement with the teacher, not with human labels. No human-drawn pile or bin boxes exist yet. All other boxes (`waste_item`, `bag`, `burning`) and every image label below are from the datasets' human annotators.

## Data

| source | licence | what it gives | train / val / test |
|---|---|---|---|
| QR4Change (urban civic issues, VIIT Pune) | CC BY 4.0 | waste or not (people's labels); teacher piles and bins | 1,590 / 193 / 184 |
| TACO | CC BY 4.0 | litter boxes (`waste_item`, `bag`), materials | 832 / 79 / 123 |
| garbage_od (Roboflow, via HF) | CC BY 4.0 | material boxes (`waste_item`), materials | 8,360 / 1,044 / 1,060 |
| D-Fire | CC0 1.0 | fire and smoke boxes (`burning`), photos without fire as background | 1,196 / 147 / 157 |

## Detector

YOLO26s (Ultralytics 8.4.175, COCO-pretrained), 80 epochs at 640 px on the RTX 5080, seed 26, best checkpoint by Ultralytics' val fitness (mostly mAP50-95); the run was resumed once from epoch 7 after the machine's session stopped. Test split: 1,521 photos (QR4Change, TACO, garbage_od, D-Fire), mAP from Ultralytics `val`.

| class | boxes (test) | who drew them | precision | recall | mAP50 | mAP50-95 |
|---|---|---|---|---|---|---|
| waste_pile | 116 | OWLv2 teacher | 0.575 | 0.466 | 0.482 | 0.307 |
| bag | 5 | people (TACO) | 1.000 | 0.000 | 0.226 | 0.120 |
| bin | 129 | OWLv2 teacher | 0.860 | 0.690 | 0.732 | 0.661 |
| burning | 212 | people (D-Fire) | 0.582 | 0.571 | 0.559 | 0.290 |
| waste_item | 8,251 | people (TACO, garbage_od) | 0.788 | 0.603 | 0.685 | 0.436 |
| all | 8,713 | | 0.761 | 0.466 | 0.537 | 0.363 |

`bag` has 26 boxes in all and 5 in test, so its row is noise. The `waste_pile` and `bin` rows say how well the detector reproduces the teacher, not how well it finds piles; no human-drawn pile or bin boxes exist in the open data we use.

Teacher settings (`training/learn/teacher.py`): queries "a pile of garbage", "a heap of rubbish", "garbage dumped on the ground" for piles, kept at score 0.3 or above (or the single best box at 0.15 or above where people labelled the photo garbage), only on photos people labelled garbage; "a garbage bin", "a dustbin", "a dumpster" at 0.3 or above on every QR4Change photo; boxes inside a kept box dropped. 1,295 pile and 1,429 bin boxes over 1,967 photos; 15 photos were checked by eye, not every box.

As a signal (QR4Change test photos, claim `waste_dump`, people's labels; score = best waste box confidence): see the signal table below.

Exports (ONNX, end to end with YOLO26's NMS-free head, output `(1, 300, 6)`), CPU latency on the training machine (Core Ultra 9 285K) with a random input, onnxruntime 1.31:

| file | for | size | threads | median latency |
|---|---|---|---|---|
| `best-640-fp32.onnx` (YOLO26s) | ml service (`YoloSignal`, S3 `models/yolo/`) | 38.2 MB | 2 / 4 | 103 ms / 77 ms |
| `best-320-fp16.onnx` (YOLO26s) | comparison, not published | 19.1 MB | 1 | 62 ms |
| `best-320-int8.onnx` (YOLO26s) | comparison, not published | 9.9 MB | 1 | 95 ms |
| `best-320-int8.onnx` (YOLO26n, phone) | phone, int8 (S3 `models/edge_int8/`) | 2.8 MB | 1 | 21 ms |
| `best-320-fp16.onnx` (YOLO26n, phone) | phone, fp16 (S3 `models/edge_fp16/`) | 4.9 MB | 1 | 13 ms |

The phone models are a separate YOLO26n trained 40 epochs at 320 px on the same data. Test mAP50 / mAP50-95 at 320 px: PyTorch 0.424 / 0.290, fp16 ONNX 0.412 / 0.280, int8 ONNX 0.372 / 0.242 (YOLO26s at 640: 0.537 / 0.363). The int8 file suits onnxruntime-web on WASM; the fp16 file suits WebGPU. The YOLO26s 320 px exports above were not published.

Desktop CPU timings stand in for a phone; expect several times slower on a mid-range Android in the browser.

## Embedding classifier

Logistic heads on an image embedding. The report-type head learns from QR4Change only (TACO has no report type), the material heads from TACO and garbage_od, the burning head from every photo (D-Fire gives the fires). Materials with fewer than 40 training photos (textile, e-waste, construction debris, medical) get no head.

Benchmark on one fixed sample (at most 800 photos per source and split, the same rows for both), regularisation picked on val:

| embedder | mean test F1 (7 heads) | waste or not, test F1 | plastic | metal | burning | latency per photo | cost per 1,000 photos |
|---|---|---|---|---|---|---|---|
| Titan Multimodal Embeddings G1 (Bedrock, 1,024 dims) | 0.919 | 0.969 | 0.899 | 0.778 | 0.908 | 218 ms median (Bedrock call to ap-south-1 from the training machine) | about $0.06, and a 200 requests per minute quota |
| SigLIP 2 base 224 (local ONNX, 768 dims) | 0.923 | 0.969 | 0.896 | 0.818 | 0.904 | 118 ms median on 4 CPU threads, 206 ms on 2 | none; 372 MB file |

They tie on accuracy, so **SigLIP 2 is used**: no per-photo cost, no Bedrock quota (Titan allows 200 requests a minute on this account), and the photo never leaves the cluster. Its heads were then retrained on every train photo:

| head | test photos with the class | precision | recall | F1 |
|---|---|---|---|---|
| report_type:waste_dump | 65 | 0.984 | 0.954 | 0.969 |
| materials:plastic | 232 | 0.876 | 0.884 | 0.880 |
| materials:organic | 247 | 0.996 | 0.980 | 0.988 |
| materials:paper | 333 | 0.952 | 0.958 | 0.955 |
| materials:glass | 272 | 0.981 | 0.952 | 0.966 |
| materials:metal | 230 | 0.861 | 0.835 | 0.848 |
| hazards:burning | 96 | 0.964 | 0.844 | 0.900 |

The waste head is the `embedding_classifier` signal and burning above 0.5 becomes a hazard. The material heads give presence, not measured shares, so they do not fill `composition` (decision 20261010-0202); composition comes from the judge's measured shares, and the material heads stay as evaluated models for later use.

## Signals and the stacker

The verifier's question for every photo below is "does it show the claimed `waste_dump`?", checked against people's labels: the 184 QR4Change test photos (65 garbage, 119 not). The meta-learner was fitted on the 193 QR4Change val photos (81 garbage), each signal scored by the ml service's own code (`ml.handlers.score_cli`), the judge being Nova Lite (now ahead of Nova Pro in the judge order; Claude is refused for this account).

Each signal alone (support at 0.5 or more counts as yes):

| signal | photos | precision | recall | F1 | ECE |
|---|---|---|---|---|---|
| rekognition_labels | 184 | 0.667 | 0.954 | 0.785 | 0.113 |
| yolo | 184 | 0.933 | 0.646 | 0.764 | 0.150 |
| embedding_classifier | 184 | 0.984 | 0.954 | 0.969 | 0.018 |
| vision_judge | 176 | 0.471 | 0.983 | 0.637 | 0.207 |

`vision_judge` precision is low because an answer of another report type (often `no_bin` for a photo of a street bin) gives a neutral 0.5, which counts as yes here; in the stack it carries little weight.

The meta-learner (`meta-v2`) is logistic regression over the signals' logits, fitted on val: one model before the judge and one after it. Weights before the judge: Rekognition 0.25, YOLO 0.65, embedding classifier 1.27, bias 1.55; after it the judge adds 0.17. Logistic regression is calibrated on the data it is fitted on, so no separate calibration step was added; the test ECE below checks it.

The full model's bias assumes every trained signal spoke; with YOLO and the embedding classifier silent its probability would sit near sigmoid(1.55) = 0.82. So `meta-v2` also carries a Rekognition-only fallback (weight 1.20, bias -0.96; after the judge 0.68 and 2.63, bias -2.84), used whenever a trained signal is missing or neutral, for example for `contaminated_water` claims, which neither YOLO nor the embedding heads can see.

**Runtime since 11 Oct 2026 (decision 20261011-0005):** the judge (Nova Lite first) now runs on every report, scan frame and cleanup, and types the detectors were not trained on go to the judge, not the Rekognition-only fallback. The replay table below describes the old runtime (judge only when unsure or split); it has not been re-run with the judge always on.

Both models are replayed end to end on test with the service's rules: auto-verify at 0.85 or more, reject under 0.5, community check in between or when two signals differ by 0.5 or more, and the judge only for those last two cases. The fallback row replays the same photos with Rekognition (and the judge) only.

| combiner | photos | accuracy | Brier | ECE | judge called | auto-verified (right) | rejected (right) | community check | judge cost |
|---|---|---|---|---|---|---|---|---|---|
| fixed weights (fw-v0) | 184 | 0.978 | 0.047 | 0.115 | 34% | 32 (32) | 89 (86) | 63 | $0.013 |
| meta-learner (meta-v2) | 184 | 0.978 | 0.020 | 0.019 | 27% | 43 (42) | 89 (86) | 52 | $0.010 |
| its Rekognition-only fallback (meta-v2) | 184 | 0.946 | 0.040 | 0.060 | 31% | 35 (35) | 96 (87) | 53 | $0.011 |

Same accuracy as the fixed weights, but the meta-learner's probabilities are honest (ECE 0.019 against 0.115), it auto-verifies 43 instead of 32 photos and asks the judge less often. Wrong automatic decisions: meta-learner 4 (1 clean photo auto-verified, 3 garbage photos rejected), fixed weights 3 (3 garbage photos rejected).

The 52 community checks are the photos where two signals are 0.5 or more apart; the disagreement rule sends them to people whatever the meta-learner says: 30 clean photos where Rekognition labels say waste and YOLO finds none, and 18 garbage photos where YOLO finds no waste box but the embedding classifier is sure. A learned disagreement rule would cut community checks sharply; that changes the contract's decision rule, so it is left for a decision.

## Site merging threshold

`backend/server` merges a report into a site within 40 m only when the two photos' SigLIP 2 vectors have cosine 0.88 or more (`MergeTargetPicker`). Measured on the 65 QR4Change test dump photos and a simulated second shot of each (crop to 70 to 90%, tilt up to 8 degrees, brightness and contrast changes, sometimes mirrored), against all 2,080 pairs of different dumps:

| threshold | second shots of the same pile kept | different piles merged |
|---|---|---|
| 0.75 (the old Titan value) | 100% | 79% |
| 0.85 | 100% | 30% |
| 0.88 | 95% | 15% |
| 0.90 | 85% | 8% |

SigLIP 2 vectors of any two dump photos are close (median 0.81), so the 40 m radius does most of the work and the embedding check only separates neighbouring piles. Real repeat photos of one pile may differ more than the simulated ones. Vectors of different sizes (an old 1,024-dim Titan vector against a 768-dim SigLIP vector) never merge.

## Bedrock vision judge

The judge (prompt `judge_v0`) on a fixed sample: the 184 QR4Change test photos (does it confirm a `waste_dump` claim exactly) and 40 D-Fire test photos (20 with fire). A photo without a valid answer counts as wrong. Cost from token counts at list prices (Nova 2 Lite at $0.30 / $2.50 per million tokens).

| model | photos | answered | waste_dump claim (accuracy) | burning (accuracy) | median latency | p90 latency | USD per 1,000 photos |
|---|---|---|---|---|---|---|---|
| Nova Lite (apac.amazon.nova-lite-v1:0) | 224 | 216 | 0.929 (n=184) | 0.825 (n=40) | 1.5 s | 2.0 s | 0.17 |
| Nova Pro (apac.amazon.nova-pro-v1:0) | 224 | 223 | 0.908 (n=184) | 0.650 (n=40) | 1.8 s | 2.6 s | 2.24 |
| Nova 2 Lite (global.amazon.nova-2-lite-v1:0) | 224 | 206 | 0.864 (n=184) | 0.750 (n=40) | 1.8 s | 2.7 s | 0.59 |

Claude Sonnet 4.6 and Haiku 4.5 were not run: Bedrock refuses them for this account until the Anthropic use-case form is submitted, so the judge order now tries Nova Lite before Nova Pro. Nova Pro's misses: 7 clean photos called a dump, and 10 dump photos called `no_bin`, `contaminated_water` or clean, or left unanswered. On this sample Nova Lite is both the most accurate and the cheapest, so `backend/ml` now tries it before Nova Pro (`settings/llm.py`; decision 20261010-0133 still lists the order).

The `judge_v0` prompt text changed after this eval: it added the `overflowing_bin` type and dropped "a full or overflowing bin that was not emptied" from `no_bin` (decision 20261010-1645). The judge numbers above, and the meta-learner fitted on the judge's answers, describe the earlier prompt; they have not been re-run.

## Judge veto replay (11 Oct, after #123)

Measured on 11 Oct 2026, after PR #123 (decision 20261011-0230). The same 224 test photos as the judge eval (184 QR4Change, claim `waste_dump`/`roadside`; 40 D-Fire, which carry no waste label) went once through the pinned models: Rekognition labels, YOLO26s (`yolo26s-640-v1`), SigLIP 2 with `clf-1` heads, and the judge with the current `judge_v0` prompt (with `photo_unclear`), Nova Lite first and Nova Pro next, as in the service; OpenAI was not called. The cached signals were then replayed through each commit's own `StackedVerifier`, `meta-v2` and report vetoes: `b273968` (before #123) and `d797ade` (#123). Both rule sets read the same judge answers, so the "before" row is the old rules on answers given to the new prompt. Every case was decided by meta-v2. One photo (`garbage_img__15`) got no valid answer from either Nova model; it took the outage path (detectors only, capped at community check).

On the 184 QR4Change photos (65 garbage, 119 not), with accepted meaning auto-verified or community check:

| rules | waste: auto-verified / community check / rejected | not waste: auto-verified / community check / rejected | accuracy | precision | recall | genuine waste rejected |
|---|---|---|---|---|---|---|
| before #123 | 41 / 22 / 2 | 1 / 59 / 59 | 0.663 | 0.512 | 0.969 | 2 (3.1%) |
| #123 | 40 / 22 / 3 | 1 / 58 / 60 | 0.663 | 0.512 | 0.954 | 3 (4.6%) |
| #123, `photo_unclear` ignored when a detector is at 0.5 or more | 41 / 22 / 2 | 1 / 58 / 60 | 0.668 | 0.516 | 0.969 | 2 (3.1%) |

Which veto rejected each photo under #123: garbage photos, `judge_veto:not_waste` 1 and `judge_veto:unclear` 2; clean photos, `judge_veto:not_waste` 57, `judge_veto:unclear` 2, and 1 by the combiner (probability under 0.5, no veto). `low_support`, `combined_no` and `detectors_veto:no_waste` fired on no QR4Change photo. #123 changed two decisions: one garbage photo moved from auto-verified to rejected, and one clean photo from community check to rejected.

The three garbage photos rejected under #123:

| photo | veto | judge answer | detectors (Rekognition, YOLO, embeddings) | judge rationale | before #123 |
|---|---|---|---|---|---|
| `garbage_img__77_646c2a39.jpg` | `judge_veto:unclear` | `overflowing_bin` 0.8, unclear | 1.00, 0.87, 1.00 (meta-v2 0.9998) | "A bin is overflowing with various waste materials." | auto-verified |
| `garbage_img__54_2d348730.jpg` | `judge_veto:unclear` | `not_waste` 0.9, unclear | 0.00, 0.00, 0.06 | "The photo is too blurry to identify any waste or context." | rejected |
| `garbage_img__2_76d9e958.jpg` | `judge_veto:not_waste` | `not_waste` 0.95 | 0.00, 0.00, 0.45 | "The photo shows food items and utensils, not waste." | rejected |

Only `garbage_img__77` is a new false rejection. The judge marked it unclear while naming the waste in its rationale, and all three detectors were sure. Because an unclear answer also sets the judge's support to 0, `judge_veto:low_support` would reject it too, so lowering the 0.2 bar changes nothing here. A 0.1 bar gives exactly the #123 numbers, since the rejected photos have supports of 0.05 and 0. Dropping `combined_no` also changes nothing on this split.

Unclear and dark photos: the judge set `photo_unclear` on 5 of 224 photos (2 garbage, 2 clean, 1 D-Fire landscape at mean brightness 147). None of the 17 dark photos (mean luma under 70: 5 QR4Change, 12 D-Fire, mostly night fires) was marked unclear. D-Fire decisions were the same under both rule sets: 28 rejected (27 `judge_veto:not_waste`, 1 `judge_veto:unclear`) and 12 community check.

The precision of about 0.51 is not caused by #123. 58 of the 119 clean photos go to community check under #123, and 59 before it. Under #123, 57 of the 58 are photos the judge calls `no_bin` (33) or `overflowing_bin` (24), mostly bins going by its rationales, and another waste type counts as support 0.5. Against detectors at about 0 that is a disagreement, and `combined_no` needs a judge support under 0.5, so it does not fire. Auto-verification stays precise: 40 of 41 are garbage under #123, and 41 of 42 before it.

Cost of the run: 235 Bedrock judge calls (230 Nova Lite, 5 Nova Pro; schema retries included) for 583k input and 34k output tokens, about $0.058 at list prices; 224 Rekognition DetectLabels calls. Median judge latency was 1.7 s. YOLO and SigLIP ran locally. Scores and the one-off replay scripts are kept outside the repo, like the other scored files.

## Structured judge re-test (11 Oct, judge_v1)

Measured on 11 Oct 2026 for decision 20261011-0305 (issue 135). The same 224 test photos and the same cached detector signals as the #123 replay above (claim `waste_dump`/`roadside`), with fresh judge calls on the new `judge_v1` prompt (per-attribute yes, no or uncertain, and a user verdict on the stated claim), Nova Lite first and Nova Pro next; OpenAI was not called. Each case then went through this branch's own `StackedVerifier`, `meta-v2` and report rules. Every case was decided by meta-v2. One photo (`garbage_img__90`) got no valid answer from either Nova model and took the outage path (community check).

On the 184 QR4Change photos (65 garbage, 119 not), accepted meaning auto-verified or community check:

| rules | waste: auto-verified / community check / needs confirmation / rejected | not waste: auto-verified / community check / needs confirmation / rejected | accuracy | precision | recall | genuine waste rejected | clean photos accepted |
|---|---|---|---|---|---|---|---|
| #123 (`judge_v0`) | 40 / 22 / 0 / 3 | 1 / 58 / 0 / 60 | 0.663 | 0.512 | 0.954 | 3 (4.6%) | 59 (49.6%) |
| `judge_v1` (this change) | 41 / 21 / 0 / 3 | 1 / 6 / 0 / 112 | 0.946 | 0.899 | 0.954 | 3 (4.6%) | 7 (5.9%) |

Clean photos accepted fell from 59 to 7, and community checks of clean photos from 58 to 6. The target of at most 2 genuine waste photos rejected was not met: it stays at 3 of 65, which is accepted as the outcome. Two of the three were rejected under #123 too, arguably correctly (a photo too blurry to show anything, and a tray of food).

- The three garbage photos rejected: `garbage_img__54` (`judge_veto:unclear`, "too blurry", every detector under 0.1; rejected under #123 too), `garbage_img__2` (`judge_veto:not_waste`, "a person holding a tray with food", detectors 0, 0, 0.45; rejected under #123 too) and `garbage_img__210` (`judge_veto:low_support`, "a dirty puddle on the roadside, not a waste dump", YOLO 0.36, embeddings 0.13; new). `garbage_img__77`, the false rejection of #123, is now judged usable and auto-verified.
- The detector exception fired three times: `garbage_img__80` (judge: photo unusable; YOLO 0.72, embeddings 0.97) went to community check instead of a rejection, and two clean photos where YOLO alone was sure (0.93 on a snowy owl, 0.6 on a clean roadside bin) went to community check after a judge "no". The shipped rule counts YOLO only; counting the embedding head too gives the same numbers on this split, but the head gave 0.77 to the prod indoor-cupboard photo the judge rightly rejected. Rekognition labels are at 0.5 or more on 31 clean photos, so counting them would lift far more.
- Of the 7 clean photos accepted, 5 are judge "yes" answers on photos with a bin and some litter, one of them auto-verified (a bucket of waste indoors, every detector at 0.6 or more).
- No photo reached `needs_confirmation`: the judge said uncertain in 5 user verdicts, and every one of them also had a "no" attribute or an unusable photo, which take precedence. The reporter-confirmation path is therefore not exercised by this split.
- `photo_usable` was "no" on 7 of 224 photos (2 garbage, 4 clean, 1 D-Fire). None of the 17 dark photos (mean luma under 70) was marked unusable or uncertain. All 40 D-Fire photos were rejected (38 `not_waste`, 1 `low_support`, 1 `unclear`), against 28 under #123.

Cost of the run: 237 Bedrock judge calls (234 Nova Lite, 3 Nova Pro; schema retries included) for 743k input and 41k output tokens, about $0.064 at list prices. The longer prompt costs about 3,100 input tokens a call, against 2,500 for `judge_v0`. Median judge latency was 1.7 s. No detector was re-run. The re-test scripts and answers are kept outside the repo, like the other scored files. The meta-learner was fitted on `judge_v0` supports and has not been refitted.

## Gaps and what would change these numbers

- Public data only: no Jodhpur photo is trained on or evaluated, and QR4Change's clean photos include street scenes from outside India, so real-world accuracy in Jodhpur is not measured here.
- No human pile or bin boxes; no boxes at all for construction debris, medical waste, dead animals or chemicals. No size labels, so `YoloSignal`'s size class (share of the photo under waste boxes: under 10% small, under 35% medium, else large) is a rule, not a trained estimate.
- The material heads measure presence only and are not used for composition. Textile, e-waste, construction debris and medical have no head.
- Only `waste_dump` claims have labelled photos; `YoloSignal` and `EmbeddingSignal` are neutral for claims they cannot see (`contaminated_water`; the embedding head also for `open_construction`), combiners skip neutral signals, and the meta-learner then uses its Rekognition-only fallback.
- The after-judge models were fitted on Nova Lite answers; refit them if the judge moves to Claude.
- Reproduce: `backend/ml/training` `learn` commands (`teacher`, `detector-data`, `detector-train`, `detector-eval`, `detector-export`, `embed`, `heads`, `cases`, `stacker`, `bench`, `publish`) and `backend/ml` `ml.handlers.score_cli`; scored files and runs stay outside the repo.
