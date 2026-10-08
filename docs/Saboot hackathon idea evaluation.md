# Saboot Wins Through Proof, Not Plumbing

Saboot is a strong Waste and Energy entry, and it can win the track. The idea is good enough. What could lose it is the stack in the synopsis, because that stack puts Execution at risk, and the judges' own wording is that "a working feature beats several unfinished ones". Saboot's edge is the last mile. No Indian or global complaint app we found attaches satellite history to a complaint, cites the rule that applies, and sends it to the regulator. No satellite waste tool we found gives a citizen a complaint ready to file. Two of Saboot's three data sources, NASA FIRMS and Sentinel-2 from the Registry of Open Data on AWS, are on the organizers' own suggested list. Its cited-retrieval design also matches WeMakeDevs' published guide for real-data AI projects almost exactly. Two synopsis choices should go:

- **Big data.** The event page, rules and announcement set no big-data, Spark, EMR or Athena requirement.
- **OpenSearch and EMR Serverless.** Jodhpur district comes to only about half a million embedding vectors, so neither is needed for lookalikes or for rule search.

The five changes that matter most:

1. **Cut to a five-service core:** Amplify, Lambda running Strands, Bedrock with a Knowledge Base on S3 Vectors, S3, and DynamoDB. Pre-render the imagery and precompute the lookalikes.
2. **Address complaints to the RSPCB Jodhpur Regional Office** under rules 41(4) and 17(3), not only to the city.
3. **Make every citation provable.** Hash the gazette and show a check that every quoted clause appears in it word for word.
4. **Present lookalikes as candidates for human review,** with a measured precision.
5. **Add a satellite "closed, but is it clean?" check.** No app we found does this.

Judges see only a video of up to 3 minutes, a public repo and a writeup. The path that must never be cut is: pin, dated satellite timeline, fire anomalies, cited Hindi draft. Freeze features by Saturday 20:00 IST and record on Sunday morning, because the exact deadline hour has not been announced.

## A contender whose edge is the last mile, not the stack

**How the event is judged.** There are five criteria, with no published weights: Idea and Impact, Built on AWS, Design and usability, Execution, and Demo video. **Judges score only the submission: a public repo, a YouTube video of up to three minutes, and a short writeup. There is no live demo and no interview** ([Rules](https://www.wemakedevs.org/aws/rules); [Event page](https://www.wemakedevs.org/aws/environmental-hacks)). AWS use is mandatory for prizes and must appear in the video. Mentioning it only in the writeup does not count ([Rules](https://www.wemakedevs.org/aws/rules)). Each track is judged separately, and each track winner receives **₹2,00,000 plus $2,000 in AWS credits**. Saboot therefore competes only against the Waste and Energy field ([Event page](https://www.wemakedevs.org/aws/environmental-hacks)).

**Why the idea is strong on these terms.**

- **The organizers already point at your data.** Their announcement lists FIRMS and Sentinel-2 on the Registry of Open Data on AWS as suggested sources ([Announcement](https://www.wemakedevs.org/blogs/announcing-environmental-hacks)).
- **Their own guide describes your design.** It recommends downloading official documents from official domains, hashing them, indexing them, and running a check that every quoted line appears in its source. The model only explains what code has already computed ([Real-data AI guide](https://www.wemakedevs.org/blogs/how-to-build-a-real-data-ai-project-on-the-aws-open-source-stack)).
- **The product gap is real.** Swachhata, MCD 311, CPCB Sameer and Rajasthan Sampark take photos and route tickets. None we found attaches satellite history, cites the applicable rule, or independently checks whether a "resolved" complaint was actually fixed.
- **The closure gap is documented.**
  - Sampark reports **more than 98% of about 73 lakh cases "disposed"** ([Deccan Herald](https://www.deccanherald.com/india/problems-of-people-of-rajasthan-been-halved-says-cm-ashok-gehlot-1150917.html)). Yet in February 2025 Rajasthan's Chief Secretary had to order feedback collection to verify whether grievances were genuinely addressed ([SocialNews](https://www.socialnews.xyz/2025/02/20/rajasthan-chief-secretary-calls-for-timely-resolution-of-complaints-on-sampark-portal/)).
  - MCD told the NGT that 85.85% of its 311 complaints were resolved. Of the air-pollution complaints in October 2024, only 3,547 of 11,871 were resolved ([Outlook Business](https://www.outlookbusiness.com/planet/industry/rs-9535-lakh-fine-imposed-for-illegally-dumping-debris-in-delhi-mcd-report-to-ngt)).
  - Reporters found Gurugram's Swachh Map app using fake "cleaned" photos ([HT via PressReader](https://www.pressreader.com/india/hindustan-times-chandigarh/20180714/281629601041926)).
- **Satellite waste tools do not serve citizens.** Tools such as Global Plastic Watch and Earth Index serve researchers and regulators. None we found gives a citizen a complaint ready to file ([PLOS ONE](https://journals.plos.org/plosone/article?id=10.1371/journal.pone.0278997); [Earth Genome](https://www.earthgenome.org/blog/embeddings-for-all)).

**Timing favours the pitch.**

- The **Solid Waste Management Rules, 2026 took effect on 1 April 2026.**
- **Rule 15(1) requires every local body to map all dumpsites and "garbage vulnerable points" by 31 October 2026,** three weeks after the hackathon ends ([Gazette text](https://www.mpcb.gov.in/sites/default/files/standing_orders/SWM_2026.pdf)).
- The official legacy-dumpsite inventory counts only sites holding more than 1,000 tonnes ([Lok Sabha](https://eparlib.nic.in/bitstream/123456789/2982283/1/AS309_kW2GKS.pdf)). Smaller and newer illegal dumps fall outside national tracking.
- Jodhpur's burning season is starting. In 2024, VIIRS fire detections in a Jodhpur district bounding box peaked at 93 in October, 269 in November and 148 in December ([FIRMS 2024 India CSV](https://firms.modaps.eosdis.nasa.gov/data/country/viirs-snpp/2024/viirs-snpp_2024_India.csv)).

**Jodhpur also provides the best story we found.** In **OA 54/2023 before the NGT Central Zone Bench**:

- Residents alleged that the municipal corporation was dumping waste in a residential area, even though the Jodhpur Development Authority (JDA) had allotted land at Geva for a dump in December 2019.
- On 21 July 2023 the tribunal disposed of the case "in absence of any violation of any statutory rule". It gave the Commissioner two months to examine the matter.
- An execution application filed in March 2024 (EA 3/2024) said that "even after passing of more than 08 months no action has been taken" ([NGT EA 3/2024](https://www.greentribunal.gov.in/sites/default/files/news_updates/E.A.%20No.%2003-2024%20AJAY%20SINGH%20KACHAWAH%20VS%20STATE%20OF%20RAJASTHAN%20%26%20ORS.pdf)).

The case foundered on the two things Saboot supplies: a cited rule, and documented proof that the problem persists. Put the case number on screen, not the petitioner's name.

**Weaknesses, all fixable:**

- **Too many services.** The synopsis lists about 12 managed services, two search systems and an EMR pipeline. We judge that to be two to three times what three people can make reliable by Sunday.
- **Track fit.** Illegal dumping is not in the Waste and Energy example list, and burning overlaps the Air track. The organizers do say the listed problems are "starting points, not a closed list" ([Event page](https://www.wemakedevs.org/aws/environmental-hacks)). Frame Saboot as waste that ends up in an open dump or a fire instead of reaching a facility.
- **Lookalikes are the weakest technical claim.**
  - Each Earth Index chip is about 320 m on a side, roughly 10 ha ([VectorChord](https://docs.vectorchord.ai/vectorchord/customer-stories/earthgenome.html)).
  - By contrast, 82% of the sites Global Plastic Watch detected were smaller than 0.5 ha. Only 53% of its candidates in Southeast Asia passed human review ([PLOS ONE](https://journals.plos.org/plosone/article?id=10.1371/journal.pone.0278997)).
  - Keru, the obvious Jodhpur seed site, is a sandstone quarrying area. Its quarry waste heaps will look like dumps ([ResearchGate](https://www.researchgate.net/publication/342611080_Environmental_Impacts_of_Sandstone_Quarrying_at_Keru_Jodhpur_Rajasthan)).
- **FIRMS is weak evidence for small dump fires.**
  - **413 of the 851 VIIRS detections in the Jodhpur box in 2024 (49%) are flagged as static industrial sources.**
  - The 375 m pixels and the overpass times (around midday and around 1 a.m.) miss most short evening burns ([FIRMS 2024 India CSV](https://firms.modaps.eosdis.nasa.gov/data/country/viirs-snpp/2024/viirs-snpp_2024_India.csv); [FIRMS FAQ](https://www.earthdata.nasa.gov/data/tools/firms/faq)).

| Criterion (our assessment) | Synopsis as written | After the changes in this report |
|---|---|---|
| Idea and Impact | Strong problem. "What changes" for residents is only implied, and lookalikes overclaim | Strong: names the regulator, rechecks "resolved" tickets, states a measured precision |
| Built on AWS | Strong on paper, but services are not tied to visible steps | Strong: every service maps to a visible step, with console shots in the video |
| Design and usability | Clear four-step flow, otherwise unknown | Depends on the timeline slider and on showing citations beside the draft |
| Execution | At risk: about 12 services, two search systems, live raster processing in Lambda | Achievable: five-service core, pre-rendered data, cached demo mode |
| Demo video | Not planned | Scripted below, with the draft on screen by about 1:05 |

## Thirteen synopsis lines to rewrite before the first commit

Every row below either changes what the team builds or changes what the team claims. Rows 1 to 7 cut build risk. Rows 8 to 13 cut claim risk. Claim risk matters because the organizers' guide says that "claiming real data without a way to prove it" is a common mistake. It also says that being open about limits is more credible than implying full coverage ([Real-data AI guide](https://www.wemakedevs.org/blogs/how-to-build-a-real-data-ai-project-on-the-aws-open-source-stack); [Live-data guide](https://www.wemakedevs.org/blogs/how-to-build-a-live-data-project-on-the-aws-serverless-stack)).

| # | Synopsis says | What the research found | Change it to |
|---|---|---|---|
| 1 | "Big data concepts: distributed batch processing with Spark, and partitioned columnar storage in a data lake." | No event page, rule or announcement mentions big data, Spark, EMR, Athena or data lakes. The organizer guides target "weekend-scale" serverless projects ([Rules](https://www.wemakedevs.org/aws/rules); [Live-data guide](https://www.wemakedevs.org/blogs/how-to-build-a-live-data-project-on-the-aws-serverless-stack)) | Remove the line from the pitch. Keep partitioned Parquet with Athena, because it is cheap and easy to show. Make Spark an optional job capped at 4 hours. If the line came from a college requirement, keep the job for that reason only |
| 2 | Lookalikes "searched with OpenSearch vector search" | Jodhpur district is about 0.4 to 0.6 million vectors (about 0.6 to 0.9 GB as float32). Brute-force search returns in well under a second. OpenSearch Serverless Classic has a floor of about $175 per month ([Source Coop](https://data.source.coop/earthgenome/earthindexembeddings/); [cloudburn](https://cloudburn.io/blog/amazon-opensearch-pricing)) | Numpy cosine search in a Lambda, or Amazon S3 Vectors, which costs almost nothing while idle. Precompute GeoJSON results for the seed sites |
| 3 | Rule retrieval via "OpenSearch hybrid search (BM25 plus vectors)" | A Bedrock Knowledge Base on S3 Vectors is close to one click, but it supports semantic search only ([AWS S3 docs](https://docs.aws.amazon.com/AmazonS3/latest/userguide/s3-vectors-bedrock-kb.html)). A self-managed hybrid index is about a day of work for first-timers (our estimate) | A Bedrock Knowledge Base on S3 Vectors, plus a hand-checked JSON table of rules, plus a check that every quote appears word for word in the gazette. Either fuse `rank_bm25` results inside the tool, or describe it as "semantic retrieval with metadata filters" |
| 4 | "Amazon EMR Serverless filters and indexes the embedding files" | Warm workers kept by EMR Serverless pre-initialized capacity are billed even when idle ([AWS docs](https://docs.aws.amazon.com/emr/latest/EMR-Serverless-UserGuide/pre-init-capacity.html)). Glue Spark costs $0.44 per DPU-hour with a 1-minute minimum ([Glue pricing](https://aws.amazon.com/glue/pricing)) | Clip the data with DuckDB first, so nothing depends on Spark. If you get time, port the script to a single parameterized AWS Glue PySpark job |
| 5 | "Sentinel-2 open data read directly from Amazon S3" | The image files (COGs) are in us-west-2, and a full true-colour tile is about 184 MB. Collection 1 has a large gap in 2022 ([Earth Search](https://earth-search.aws.element84.com/v1/search)) | Pre-render image chips offline from `sentinel-2-c1-l2a`, using legacy `sentinel-2-l2a` for 2022, and store them in your own S3 bucket |
| 6 | "Amazon API Gateway and AWS Lambda" | API Gateway integrations time out at 29 seconds ([re:Post](https://repost.aws/knowledge-center/api-gateway-timeout-limit)) | Use a Lambda Function URL for the agent with a 90 to 120 second timeout. Alternatively, have the client submit the job and then poll for the result |
| 7 | "384 values per 320 m patch" | Correct, but chips overlap by 50% (a stride of about 160 m). There are also two model generations whose vectors are incompatible ([Source Coop](https://source.coop/earthgenome/earthindexembeddings); [Earth Genome STAC](https://stac.earthgenome.org/collections/ssl4eo_yearly_embeddings)) | Keep the line, add "50% overlap", and pick one model. Never mix vectors from the two models |
| 8 | "AI finds places ... that look the same from space" | No published validation of Earth Index for dumps exists. Bare soil and quarries confuse it ([PLOS ONE](https://journals.plos.org/plosone/article?id=10.1371/journal.pone.0278997)) | "Visually similar candidate sites for human review", with precision@20 (the share of the top 20 results that are real dumps) measured on a hand-labelled Jodhpur set |
| 9 | "any fires detected there" | 49% of the 2024 detections in the Jodhpur box are static sources, and small fires are often missed | "Thermal anomalies recorded near this location", with source-type labels and the note that "absence is not evidence of no burning" |
| 10 | "complaints are closed without action" | This is a documented pattern, but no measured rate exists. Do not quote a fake-closure percentage | "Complaint systems report near-total disposal (Sampark: more than 98%), while the state itself has ordered checks on whether grievances were really resolved, and reporters found fake 'cleaned' photos" |
| 11 | "few people know what they prohibit" | We found no survey of awareness of the rules | Drop it, or say that the rules are six months old and most apps still route complaints to the body that runs the dump |
| 12 | "If time allows: Hindi voice input and a public case tracker" | Voice input adds little value in a recorded demo. Public trackers invite misleading comparisons between areas ([FixMyStreet](https://osm.fixmystreet.com/about/understanding-report-data)) | Replace them with the closure check, the hashed evidence pack and the routing pack |
| 13 | The agent "retrieves ... the responsible authority" | Rules 17(3) and 41(4) put enforcement and environmental compensation with the State Pollution Control Board, and CPCB steps in if the board stalls | Address the Jodhpur Municipal Corporation, the RSPCB Regional Office Jodhpur and the District Collector, and state the CPCB escalation route |

The "What is new" paragraph should also add two things: routing the complaint to the regulator, and rechecking "resolved" tickets against later satellite passes. The current claim, joining complaint apps and satellite search, is easy for a judge to dismiss as integration. Rechecking whether a complaint was really fixed is a new capability, not just integration.

## Cite rule 5(1)(f), address RSPCB, and prove every quote

**Citation format.** Every draft should cite the rules as: "Solid Waste Management Rules, 2026, notified vide S.O. 388(E) dated 27.01.2026 under sections 3, 6 and 25 of the Environment (Protection) Act, 1986, in force from 01.04.2026 (rule 1(2))."

- The notification is an S.O. number, not a G.S.R. number.
- Do not index the 2024 draft (S.O. 5369(E)), because its rule numbering may differ from the final rules.
- **Environmental compensation is rule 17. Rule 21 is accident reporting.** At least one secondary comparison table gets this wrong ([Gazette text](https://www.mpcb.gov.in/sites/default/files/standing_orders/SWM_2026.pdf)).
- The rule numbers here come from a full-text copy hosted by the Maharashtra Pollution Control Board. Download the original from e-Gazette and hash that file for the corpus.

The table below sets out the addressee logic. It is our inference from the duties the rules assign, so the agent should pick from it in code rather than reason it out in a prompt.

| What the pin shows | Rules to cite (SWM Rules 2026 unless noted) | Address to | Copy, then escalate |
|---|---|---|---|
| Dumping or burning on a road, open space or vacant plot inside city limits | **5(1)(f)**: a generator shall not throw, burn or bury waste on streets, open public spaces, drains or water bodies.<br>**39(7)**: the local body must direct generators not to litter, burn or bury.<br>**39(2)(vii) and (xi)**: the action plan must cover garbage vulnerable points and plots vulnerable to open dumping.<br>**39(31), 39(37)**: spot fines in bye-laws.<br>**15(1)**: map garbage vulnerable points by 31 October 2026 | Commissioner, Jodhpur Municipal Corporation, attention SWM nodal officer (39(12)) | Regional Officer, RSPCB Jodhpur (41(1)(i), 41(4)). District Collector, who reviews the local body each quarter (37(ii)) |
| Burning or poor practice at a municipal dumpsite or transfer station | **3(1)(t)**: definition of "dump sites".<br>**15(4)(v) with Schedule IV**: fire prevention, including CCTV, fencing, patrolling and landfill gas detectors.<br>**15(7)**: no fresh waste on legacy sites under biomining.<br>**41(4)**: the board "shall impose Environmental Compensation ... including for indiscriminate dumping of solid waste by local authorities" | Regional Officer, RSPCB Jodhpur | Jodhpur Municipal Corporation Commissioner. District Collector (Schedule IV emergency plan) |
| Site outside municipal limits | **40(3)(iii)(d)**: the Gram Panchayat must ensure "open dumping and burning of solid waste does not take place".<br>**40(2)(j)**: map vacant plots vulnerable to dumping | Sarpanch or Gram Panchayat, then the Block Development Officer or Zila Parishad CEO | RSPCB Regional Office |
| No action after a reasonable time | **17(3)**: the state board levies compensation, and if it "does not take action in reasonable time", CPCB "shall issue directions".<br>**17(5)**: action under section 15 of the Environment (Protection) Act.<br>**BNSS s.152**: magistrate's conditional order to remove a public nuisance ([Lexibal](https://lexibal.com/bnss-section-152-nuisance/)) | CPCB. Sub-Divisional Magistrate or District Magistrate | NGT Central Zone Bench, Bhopal. An application must be filed within 6 months of the cause of action under NGT Act s.14(3) ([Mantri Techzone](https://digiscr.sci.gov.in/admin/judgement_file/judgement_pdf/2019/volume%204/Part%20I/Mantri%20Techzone%20Pvt.%20Ltd.%20_%20Forward%20Foundation%20And%20Ors._1701425548.pdf)) |
| Any burning complaint, as precedent | NGT OA 199/2014 (Almitra Patel), 22 December 2016: a complete ban on open burning, with compensation of ₹5,000 per simple incident and ₹25,000 per bulk incident ([Business Standard](https://www.business-standard.com/article/news-ians/ngt-orders-enforcement-of-waste-management-rules-bans-open-burning-of-waste-116122301087_1.html)) | Label this as an NGT order, never as an SWM 2026 clause | |

**What the draft must not claim.**

- **No rupee amount of compensation under the 2026 Rules.** On 4 August 2026, in *Amravati Municipal Corporation v. Ganesh Dadarao Anasane* (2026 INSC 796), the Supreme Court directed MoEFCC to frame the rule 17(2) guidelines on compensation. The next hearing was 29 September 2026, and we found no report of its outcome ([LiveLaw](https://www.livelaw.in/top-stories/solid-waste-management-rules-2026-supreme-court-directs-centre-to-frame-guidelines-on-environmental-compensation-544325)).
- **No figure for EP Act section 15 penalties.** After the Jan Vishwas amendments, one source puts them at ₹10,000 to ₹15 lakh and another gives a ₹1 lakh floor ([Law.asia](https://law.asia/new-rules-address-supreme-courts-burning-question/)).
- **No statutory response deadline.** The 21-day CPGRAMS ceiling comes from a DARPG office memorandum of 23 August 2024. It is an administrative norm, not a statute ([Tribune](https://www.tribuneindia.com/news/india/centre-cuts-public-grievances-redressal-time-to-21-days)). We found no statutory response deadline for SWM complaints. The online SWM grievance mechanism under rule 39(35) does not become mandatory until about 27 January 2027 ([Gazette text](https://www.mpcb.gov.in/sites/default/files/standing_orders/SWM_2026.pdf)).
- **The corporation's current structure.** Rajasthan has merged Jodhpur's twin corporations into one body ([The Statesman](https://www.thestatesman.com/india/rajasthan-merges-twin-municipal-corporations-in-jaipur-jodhpur-and-kota-into-single-integrated-bodies-1503510026.html)). Confirm the current ward structure and the SWM nodal officer before naming them.
- **The RSPCB office details are from 2022.** A 2022 RSPCB filing to the NGT gives the Regional Office as Plot No. SPL-2, M.I.A. Phase-I, Basni, Jodhpur-342005, rorpcb.jodhpur@gmail.com, 0291-2723225 ([RSPCB report, OA 81/2022](https://www.greentribunal.gov.in/sites/default/files/news_updates/Report%20in%20O.A.%2081-2022%2019-11-2022.pdf)). Treat these as data to re-verify, not as current facts.

**Evidence law supports the design, provided the claims stay modest.**

- **The NGT is not bound by formal evidence rules** (NGT Act s.19(3)) ([LawX](https://lawx.in/acts/section/120/1076/9279)).
- **It uses satellite imagery routinely:**
  - ISRO/NRSC images in the Ropar sand-mining case, OA 553/2024 ([CPCB report](https://www.greentribunal.gov.in/sites/default/files/news_updates/REPORT%20BY%20CPCB%20IN%20OA%20NO.%20553%20of%202024%20NEWS%20ITEM%20TITLED%20FROM%20ROPAR%20TO%20HOSHIARPUR%20VIA%20HP%2030-KM%20DETOUR%20AS%20ILLEGAL%20MINING%20DAMAGES%20BRIDGE_1.pdf)).
  - A Maharashtra Remote Sensing Applications Centre time series in OA 88/2024, a case about dumping by Pen Municipal Council ([Joint Committee report](https://www.greentribunal.gov.in/sites/default/files/news_updates/Report%20of%20the%20Joint%20Committee%20in%20OA%20No.88-2024%20%28page%20nos.436-553%29.pdf)).
- **Its usual response is to order a joint committee to verify on the ground.** So the draft should request inspection and verification. It should not declare a violation.
- **Courts need a BSA s.63(4) certificate.** Before civil and criminal courts, electronic records need a certificate stating the file's hash value and hash algorithm. Part A is filled in by the person producing the record, and Part B by an expert. The Supreme Court rejected a challenge to this requirement in *Pune Bar Association v. Union of India* on 22 May 2026 ([LiveLaw](https://www.livelaw.in/amp/top-stories/supreme-court-rejects-challenge-to-s634-bsa-mandating-hash-value-disclosure-for-electronic-evidence-535950)). Hashing late weakens admissibility ([LiveLaw explainer](https://www.livelaw.in/amp/articles/hash-value-electronic-evidences-535457)).

What Saboot should therefore do:

- Hash every artefact with SHA-256 at the moment of capture.
- For each Sentinel-2 frame, record the STAC item ID, sensing time, MGRS tile and cloud cover.
- For each FIRMS row, record the satellite, acquisition time, confidence and fire radiative power (FRP).
- Record the API URL and the retrieval timestamp.
- Generate a Part A helper sheet marked "Part B requires an expert".
- Phrase the evidence as: "satellite imagery is consistent with a dumpsite visible since <date>; we request inspection and verification."

**What to put in the retrieval corpus:**

- The e-Gazette original of S.O. 388(E), hashed.
- The Almitra Patel judgment of 2016.
- The NGT's 15 September 2022 order in OA 606/2018, which directed Rajasthan to pay about ₹3,000 crore in compensation and to remediate 161 "left out" sites ([India Environment Portal](https://indiaenvironmentportal.org.in/in-court/rajasthan-directed-by-ngt-to-pay-3000-crores-for-failure-to-comply-with-solid-waste-and-sewage-management)).
- The Supreme Court's stay of that payment ([Business Standard](https://www.business-standard.com/article/economy-policy/sc-stays-ngt-order-directing-rajasthan-to-pay-environmental-compensation-122121601121_1.html)).
- The 2026 Amravati judgment.
- The two Jodhpur matters, OA 54/2023 and OA 31/2025.

**How the rules should flow through the system.** Store the rules as data: a JSON table with the rule number, the exact text, the page and situation tags. Code selects the clauses for the situation. The model writes the prose around them. A verifier then confirms that every quoted string appears word for word in the hashed gazette text, and a template-based draft is kept as a fallback. This is the organizers' own "put rules in data, not prompts" pattern ([Real-data AI guide](https://www.wemakedevs.org/blogs/how-to-build-a-real-data-ai-project-on-the-aws-open-source-stack)).

## A five-service core keeps every judge-visible feature

### Six endpoints, checked live on 8 October

The research team queried every data source below on 8 October. Each one is public, and all except the recent-fires API work without a key.

| Source | Endpoint | Checked on 8 October | How Saboot uses it |
|---|---|---|---|
| Sentinel-2 L2A | STAC `https://earth-search.aws.element84.com/v1`, collection `sentinel-2-c1-l2a`. For 2022, the legacy `sentinel-2-l2a` (bucket `sentinel-cogs`) | Plain HTTPS COGs in `e84-earth-search-sentinel-data` (us-west-2). An unsigned request returned HTTP 200, so the bucket is not requester-pays. Jodhpur lies where tiles 43RBK and 43RCK overlap, so de-duplicate results by date. There were 88 acquisition dates in 2025, about one every 4.1 days. Collection 1 has only 10 items for 2022, against 146 in the legacy collection. The newest scene was 3 October 2026 ([Earth Search](https://earth-search.aws.element84.com/v1/search); [AWS Registry](https://registry.opendata.aws/sentinel-2-l2a-cogs/)) | Read windows of about 1 to 2 km around each seed from the `visual` true-colour asset. Take one clear frame per month from October to May, for 2019 to 2026. July and August have a median cloud cover of 91 to 92%. Credit "Contains modified Copernicus Sentinel data [year]" |
| FIRMS history | `https://firms.modaps.eosdis.nasa.gov/data/country/viirs-snpp/2024/viirs-snpp_2024_India.csv` and `.../modis/2024/modis_2024_India.csv` | No key needed. The VIIRS file is 43 MB with 552,312 India rows. The 2025 files return 404 ([FIRMS CSV](https://firms.modaps.eosdis.nasa.gov/data/country/viirs-snpp/2024/viirs-snpp_2024_India.csv)) | Clip to the district once and write Parquet partitioned by year and month for Athena. Use the `type` field to label likely static sources |
| FIRMS recent | `https://firms.modaps.eosdis.nasa.gov/api/area/csv/[MAP_KEY]/[SOURCE]/[west,south,east,north]/[DAY_RANGE]/[YYYY-MM-DD]` | DAY_RANGE is 1 to 5 days. The limit is 5,000 transactions per 10 minutes. Sources include `VIIRS_SNPP_NRT`, `VIIRS_NOAA20_NRT`, `VIIRS_NOAA21_NRT`, `VIIRS_SNPP_SP` and `MODIS_SP` ([FIRMS Area API](https://firms.modaps.eosdis.nasa.gov/api/area/)) | Fill 2025 to mid-2026 by looping 5-day windows over the `_SP` sources, and use the near-real-time (NRT) sources for the last few days. Match fires to a site within at least 375 m |
| Earth Index, SoftCon 2024 | `https://data.source.coop/earthgenome/earthindexembeddings/2024/43RBK_2024-01-01_2025-01-01.parquet`, plus tiles 43RCK, 43RBL, 43RCL, 43RBJ and 43RCJ | About 480 MB per tile with 235,099 rows. The `embedding` column is float32[384] and the model is `dinov2_vits14_softcon`. Points form a staggered grid about 160 m apart ([Source Coop](https://data.source.coop/earthgenome/earthindexembeddings/)) | Option A: carries the AWS Open Data / Source Cooperative branding |
| Earth Index, SSL4EO 2025–26 | STAC `https://stac.earthgenome.org`, collections `ssl4eo_yearly_embeddings` and `ssl4eo_yearly_embeddings_v7`. Example: `https://ei-ssl4eo-embeddings.s3.amazonaws.com/43RCK_2025-01-01_2026-01-01.parquet` | 338 MB, HTTP 200. A rolling August 2025 to August 2026 version also exists ([Earth Genome STAC](https://stac.earthgenome.org/collections/ssl4eo_yearly_embeddings)) | Option B: more current. Pick one option and never compare vectors across the two models |
| High-resolution context | Esri World Imagery Wayback tiles | Licensed for display only, not for exporting tiles for offline use ([Esri](https://goto.arcgis.com/maps/World_Imagery)) | Use it to confirm seed sites by eye and to label patches by hand. In the PDF, link to it with attribution rather than embedding tiles |

**Seed sites.**

- **Hero site: the Keru dumping yard.** It sits about 15 km west of the city. A 2013 study describes a landfill of about 20 acres behind a 48-acre processing plant, with fires seen "many times a month" ([IJERT](https://www.ijert.org/management-of-solid-waste-in-jodhpur-current-status-and-innovative-approach)). No polygon is published. Start digitizing near 26.36 N, 72.90 E, where four 2024 VIIRS detections fell within 5 km of Keru village, with FRP of 0.6 to 2.7 MW ([FIRMS CSV](https://firms.modaps.eosdis.nasa.gov/data/country/viirs-snpp/2024/viirs-snpp_2024_India.csv)).
- **Second seed: the corporation's transfer station and dumping yard "behind Central Jail".** RSPCB and the corporation inspected it jointly on 18 April 2025 under OA 31/2025 ([NGT joint committee report](https://www.greentribunal.gov.in/sites/default/files/news_updates/JCR.pdf)).
- **Negatives:** quarry waste near Keru, a brick kiln and bare desert. These show judges that the lookalike filter does not simply return "anything bare".

At 10 m, a dump of several hectares shows up as a grey-brown, mottled patch that grows over time. Individual roadside piles do not show up at all.

### What to build in place of each synopsis layer

| Layer | Synopsis | Build instead | Reason |
|---|---|---|---|
| Web | React + MapLibre on Amplify | Same. Load Noto Sans Devanagari. Render the Hindi complaint as HTML with a print stylesheet and use the browser's "Save as PDF" | All three First Commit winners had live AWS links ([Winners](https://www.wemakedevs.org/aws/first-commit/projects)). Server-side PDF libraries often mangle Devanagari, so test this on Thursday |
| API | API Gateway + Lambda | Lambda Function URLs. Give the agent a 120-second timeout and 1 GB of memory, or have the client submit the job and poll DynamoDB for the result | Avoids the 29-second API Gateway limit |
| Imagery | Read live from S3 | Pre-render offline to `s3://saboot-media/chips/{site}/{date}.png` with a manifest. Add a live chip Lambda in us-west-2 only if Saturday is green | Cross-region reads and packaging GDAL for Lambda add risk with no visible payoff |
| Fires | NASA FIRMS | Keyless CSVs converted to Parquet and queried with Athena, plus one Lambda calling the area API | Covers history without a key, and recent data with one |
| Lookalikes | OpenSearch vector search | Numpy cosine search against the mean of the positive seeds, minus similarity to the negatives. Precompute GeoJSON for the seeds. Add S3 Vectors for arbitrary pins only if time allows | S3 Vectors is generally available in Mumbai, with top-k up to 100 and almost no idle cost ([AWS News](https://aws.amazon.com/blogs/aws/amazon-s3-vectors-now-generally-available-with-increased-scale-and-performance)) |
| Rules | OpenSearch hybrid search | A Bedrock Knowledge Base with an S3 data source and an S3 Vectors store, using Cohere Embed Multilingual v3 or Titan V2, both available in ap-south-1 ([Bedrock KB docs](https://docs.aws.amazon.com/bedrock/latest/userguide/knowledge-base-supported.html)). Add the rules JSON and the verifier | Managed chunking. Each retrieved chunk carries its S3 source and page for the citation |
| Batch | PySpark on EMR Serverless | DuckDB clip first. Then, optionally, one Glue PySpark job parameterized by a district list, capped at 4 hours | Keeps the honest claim that the same job runs for every district |
| Data lake | Parquet + Athena | Same, registered in the Glue Data Catalog, with two or three queries surfaced in the UI (fires per month, sites with repeated fires) | The cheapest way to show AWS analytics on screen |
| Agent | Strands + Bedrock | Strands pinned in your own Lambda package. Four tools: `get_site_evidence`, `search_rules` (wrapping Bedrock `retrieve`), `lookup_authority` (static JSON) and `save_draft`. Structured output `{draft_text, citations[{doc, rule, page, quote}], authority, evidence_refs}` | Calling Retrieve inside a tool, rather than RetrieveAndGenerate, keeps the agent in control of the draft |
| Storage | DynamoDB + S3 | Same | |
| Add-on | none | Amazon Polly's bilingual Kajal voice to read the Hindi draft aloud ([AWS What's New](https://aws.amazon.com/about-aws/whats-new/2022/07/amazon-polly-neural-tts-support-hindi-indian-english/)) | About an hour of work, and helps with accessibility |

### Model, credit and cost traps to clear on day one

**Bedrock model access.** On 29 September 2026, AWS announced Claude Opus 5, Sonnet 5 and Haiku 4.5 for Mumbai callers through an India geographic profile that "keeps inference within India". The profile IDs are `in.anthropic.claude-sonnet-5` and `in.anthropic.claude-haiku-4-5-20251001-v1:0` ([AWS ML Blog](https://aws.amazon.com/blogs/machine-learning/amazon-bedrock-expands-claude-model-availability-to-india-cross-region-inference/)). The Bedrock documentation, however, lists the 5.5 family as reachable from ap-south-1 only through Global profiles ([Bedrock docs](https://docs.aws.amazon.com/bedrock/latest/userguide/models-region-compatibility.html)). Smoke-test both kinds of profile in the first hour.

- Prefer the `in.` profile, because it supports a "complaint data never leaves India" line in the pitch.
- Keep Nova Pro as the last fallback.
- Expect about $0.03 to $0.06 per draft (our estimate).

**Strands configuration.** Strands 1.58.1 shipped on 6 October 2026 and is marked Production/Stable. Its default provider points at Claude 4 Sonnet in us-west-2, so set `model_id` and `region_name` explicitly ([PyPI](https://pypi.org/project/strands-agents/)). The official Lambda layers map to older SDK versions (layer 2 is v1.40.0), so bundle your own pinned version ([Strands docs](https://strandsagents.com/docs/user-guide/deploy/deploy_to_aws_lambda/)).

**Credits.** The free plan gives up to $200: $100 at signup plus $20 for each of five activities, which include building a Lambda function, using Bedrock and setting up a Budget ([AWS blog](https://aws.amazon.com/jp/blogs/news/aws-free-tier-update-new-customers-can-get-started-and-explore-aws-with-up-to-200-in-credits/)). Free-plan accounts cannot take other promotional credits, so the $25 WeMakeDevs top-up probably requires upgrading the account ([Neowin](https://www.neowin.net/news/aws-free-tier-overhauled-new-users-get-200-in-credits-but-theres-a-catch/)).

**Cost guardrails.**

- Create a $30 monthly budget with alerts at $5, $15 and $25 on actual spend. Budget notifications are free ([AWS Budgets](https://aws.amazon.com/aws-cost-management/aws-budgets/pricing)).
- Tag every resource `project=saboot`.
- When creating the Knowledge Base, choose S3 Vectors explicitly. Deleting a Knowledge Base does not delete an OpenSearch Serverless collection it created, and that collection keeps billing ([cloudburn](https://cloudburn.io/blog/amazon-opensearch-pricing)).
- Never enable EMR pre-initialized capacity.
- Tear everything down after submission.

## Proof features outrank breadth in the improvement queue

Three people working about 10 hours a day through Sunday morning have roughly 80 to 90 developer-hours. The core flow needs about 45 to 55 of them, which leaves about 35 to 45 for improvements (our estimates). The improvements that earn their hours meet three tests:

- They look striking in a three-minute video.
- They answer a question a skeptical judge would ask.
- They reuse data already in the pipeline.

| Rank | Improvement | What to build | Judge question it answers | Hours (estimate) | Decision |
|---|---|---|---|---|---|
| 1 | Before/after swipe and timelapse GIF | 8 to 12 clear frames per seed, a MapLibre comparison slider, a sparkline of NDVI drop plus SWIR brightness, and a "first visible: <date>" estimate | "Is this real, and how long has it been there?" | 4–6 | Core |
| 2 | Provable citations | Hashed e-Gazette PDF, the rules JSON, an on-screen check ("N/N quoted clauses found word for word, SHA-256 matched") and a template fallback | "Did the model invent the law?" | 3–4 | Core |
| 3 | Routing pack: "File it where it counts" | The addressee logic above, plus ready-to-paste text blocks and links for Swachhata, Sampark/181, Sameer, the RSPCB email and CPGRAMS. Record ticket IDs and cite any earlier ticket in the draft | "Why not just use Swachhata?" | 2–3 | Build on Friday |
| 4 | Hashed evidence pack | SHA-256 of each photo computed on the server at upload, STAC item IDs, FIRMS rows, a QR code linking to a verification page, and the BSA s.63(4) Part A helper | "Would this hold up as evidence?" | 5–7 | Build on Saturday |
| 5 | Closure check: "Closed, but is it clean?" | When the authority marks a complaint resolved, compare the next clear Sentinel-2 pass with the frame from before the complaint. Report "still visible", "changed" or "inconclusive", with a one-click reopen | "What changes for residents?" | 4–6, reusing #1 | Build on Saturday; demo it on one simulated case |
| 6 | Lookalike precision benchmark | Hand-label 40 to 80 patches on Esri imagery: dumps against quarries, bare soil and construction. Report precision@20 and precision@50, and show three hits and three misses | "Can 320 m chips really find dumps?" | 4–6 | Required if lookalikes ship |
| 7 | Follow-up ladder and RTI draft | An escalation ladder from the Municipal Corporation to RSPCB to CPCB to an NGT filing guide. After 30 days, draft an RTI request to the city's public information officer (RTI s.7(1)). If there is no reply, draft the first appeal under s.19 ([Vikaspedia](https://en.vikaspedia.in/viewcontent/e-governance/about-rti-act-2005/first-appeal-under-rti-what-to-do-when-there-is-no-reply?lgn=en)) | "What happens after filing?" | 5–8 | Static version only (1–2 h) unless ahead of schedule |
| 8 | Exposure overlay | Population within 1 km, and schools, hospitals and water bodies within 500 m | Strengthens the impact story | 4–6 | Stretch |
| 9 | District atlas headline | Review about 100 candidates and publish counts of confirmed, probable and rejected sites | Gives the video a memorable number | 6–10 | Stretch, and only together with #6 |
| 10 | Confidence badges and misuse guards | A check that photo EXIF location and time match the pin, face blurring with Rekognition, and a rule never to name people, vehicles or businesses | "How do you prevent false accusations?" | 3–5 | Fold into #4 and the agent prompt |
| 11 | Polly Hindi read-aloud | Kajal voice | Accessibility | ~1 | Cheap add |
| Skip | Hindi voice input, public case tracker, authority inbox, offline mode, methane or CO2e estimates, Telegram bot | | | | Out of scope this weekend |

**Why the closure check is worth the hours.** It turns Saboot from a reporting app into an audit of the complaint system, which is the most convincing answer to "what changes".

- Every closure statistic above is self-reported by the agency.
- People whose first FixMyStreet report gets fixed are **57% more likely to report again** ([PAR abstract](https://academicnewsletter.sufe.edu.cn/info/422186)).
- Closure verification is therefore the feature most likely to bring citizens back.

**Why the routing pack matters.** It answers the "why not Swachhata?" challenge with evidence. Outside the National Capital Region (NCR), Sameer forwards complaints to state pollution boards by email, where they can go unnoticed ([Deccan Chronicle](https://deccanchronicle.com/southern-states/telangana/sameer-app-dysfunctional-complaints-go-unattended-1854571)). In the Jodhpur NGT case, the city ran the dump itself. Saboot works alongside the city apps and escalates to the regulator when they fail.

## Four days, three builders, one path that never breaks

### Who does what, when

**Placeholder roles.** The research did not cover each person's skills, so swap these by who already knows React, Python geospatial work or AWS:

- **Hemang:** frontend and video.
- **Girish:** geo and data.
- **Harshit:** agent, legal corpus and the AWS account.

**The never-cut path.** The organizers' advice is to get "a thin version of the whole flow working early, using sample data if needed", and to freeze features before the final day ([Plan guide](https://www.wemakedevs.org/blogs/how-to-plan-a-cloud-project)). Saboot's thin version is: pin, then a dated satellite timeline, then fire anomalies, then a cited Hindi draft with the verifier and a hashed photo. It runs end to end for three seed sites.

| When (IST) | Hemang: frontend and video | Girish: geo and data | Harshit: agent, legal, AWS | Gate |
|---|---|---|---|---|
| Thu 8 Oct, first 90 min (all three) | Create the GitHub repo now, after kickoff, and commit from all three accounts. Connect Amplify to `main` | Pick the Keru and Central Jail seeds plus three negatives. Register a FIRMS MAP_KEY | Create the AWS account in ap-south-1 with access for all three. Set up the $30 budget. Run the Bedrock smoke test on the `in.` and `global.` profiles and on Nova Pro. Students graduating in 2027 or 2028 start SheerID verification | Bedrock works from Mumbai: go or no-go |
| Thu, rest of day to 23:30 | Vite + React + MapLibre skeleton, pin drop, side panel fed by mock JSON, Devanagari font, deploy to Amplify | Download one Earth Index tile and check its schema. Clip the 2024 FIRMS CSV to Parquet. Render chips for one site with `pystac-client` | Download and hash the e-Gazette PDF. Extract the rules JSON. Create the Knowledge Base on S3 Vectors. Run a local Strands agent that writes a first English draft and a Hindi test | 23:00: map live on Amplify, Retrieve returns relevant clauses, schema verified |
| Fri 9 Oct, 09:00–23:30 | Timeline slider and swipe, sparkline, fire layer and burn calendar, draft panel with citation cards, print-to-PDF | Chips for all seeds (legacy collection for 2022) and the GIF. FIRMS Lambda. Clip four to six embedding tiles with DuckDB, write partitioned Parquet, register it in the Glue Catalog, write Athena queries. Numpy lookalikes | Agent Lambda behind a Function URL with four tools and structured JSON. Verifier. SHA-256 on upload. DynamoDB cases table. Guardrail prompt: never name people, describe location only, not legal advice | 13:00: one site works locally. 22:00: the never-cut path works when deployed, for three sites, or else cut to precomputed data only |
| Sat 10 Oct, 09:00–14:00 | Hotspot layer, routing pack UI, evidence-pack view | Precomputed lookalike GeoJSON. Hand-label patches and compute precision@20. Optional 4-hour Glue job | A native Hindi speaker reviews five drafts. Model fallback chain. Cached "golden" responses behind `?demo=1`. Routing pack content | Fallback stubs all in place by noon |
| Sat 14:00–20:00 | Polish loading, empty and error states | Closure check on a simulated case | Static follow-up ladder and RTI template. Polly read-aloud | **20:00 feature freeze** |
| Sat 20:00–23:30 | All three: bug bash on different devices. README with architecture diagram, "Where AWS fits" table, "try it in 2 minutes" and known limits. Final video script and a rough backup recording. Draft the Builder Center blog post | | | Backup take saved |
| Sun 11 Oct | 08:00–09:30 fixes only, test in an incognito window, re-seed data. 09:30–12:30 record in segments. 12:30–14:30 edit, add captions, export at 3:00 or less | Make the repo public. Finish the writeup | Publish the blog post. Check the budget | Submit by about 15:00, or earlier if a cutoff is announced. Tear down afterwards |

**Fallbacks.** Each fallback exists so the recording never stalls.

| Failure | Fallback |
|---|---|
| Bedrock throttling | Retry, then Haiku, then Nova Pro, then the cached golden draft |
| Knowledge Base failure | A static top-k rules JSON per site |
| FIRMS outage | Athena over the archive |
| Live lookalikes fail | Precomputed GeoJSON |
| Amplify breaks | The last good build, or record from a local build |
| Agent slower than about 25 seconds | A staged progress display ("Retrieving rules… Drafting…") |

Say in the writeup that demo mode replays real outputs the system produced. The organizers list "bundling static data and presenting it as live" as a mistake ([Real-data AI guide](https://www.wemakedevs.org/blogs/how-to-build-a-real-data-ai-project-on-the-aws-open-source-stack)).

**Two rules-page traps.**

- **Repo history.** A repository history that does not match the event dates is grounds for disqualifying the whole team ([Rules](https://www.wemakedevs.org/aws/rules)).
- **Delhi day.** The optional build day at DTU Delhi needs a separate application and adds nothing to the score ([Announcement](https://www.wemakedevs.org/blogs/announcing-environmental-hacks)). Skip it unless someone is already in Delhi.

### Cut from the top when a gate goes red

| Order | Cut | What keeps the story intact |
|---|---|---|
| 1 | Hindi voice input | Typed Hindi plus Polly read-aloud |
| 2 | Public case tracker | Nothing needed |
| 3 | Live chip Lambda for arbitrary pins | Pre-rendered seed sites plus a Copernicus Browser link |
| 4 | EventBridge FIRMS poller | Mention it as the next step |
| 5 | BM25 fusion | Describe retrieval as "semantic retrieval with metadata filters" |
| 6 | Live S3 Vectors lookalikes | Precomputed seed GeoJSON |
| 7 | Glue or Spark job | DuckDB writes the same partitioned Parquet, still queried by Athena |
| 8 | Full follow-up ladder | A static "next steps" panel with the RTI template |
| 9 | Lookalikes entirely, together with the benchmark | One line in the video: "next, a district atlas" |
| Never | Pin, timeline, fire anomalies, cited Hindi draft with verifier, hashed photo | |

Lookalikes are cut before the closure check because they cost more, carry the most risk of embarrassment (quarries shown as "dumps"), and add less to the "what changes" story.

## The three-minute video is the product

**What the organizers prescribe.**

- Roughly **20 seconds on the user and the problem, 90 on the working flow, 30 on architecture, and the rest on one failure case and next steps.**
- Record the real product on screen, not slides ([Plan guide](https://www.wemakedevs.org/blogs/how-to-plan-a-cloud-project)).
- The video must show what the product does, who it is for and where AWS fits ([Event page](https://www.wemakedevs.org/aws/environmental-hacks)).
- Anything not shown in the video does not count ([Rules](https://www.wemakedevs.org/aws/rules)).
- State data sources and how fresh they are, and describe in one sentence the person you are building for ([Announcement](https://www.wemakedevs.org/blogs/announcing-environmental-hacks)).

**What last month's winners did.** First Commit, the previous event on this tour, was won by projects with a concrete Indian persona: Suraksha's "Amma" speaks Hindi or Hinglish. The winning READMEs were written for judges, with a "Where AWS fits" table, test counts and "known gaps" ([Winners](https://www.wemakedevs.org/aws/first-commit/projects); [Beacon repo](https://github.com/Prashant-thakur77/Beacon)).

**Saboot's persona.** Pick one, for example a residents' welfare association (RWA) secretary living near the dump who files in Hindi. Do not invent statistics. Time the "pin to draft" interval live and use the real number.

| Time | On screen | Narration (draft) | Criterion |
|---|---|---|---|
| 0:00–0:15 | The map opens on Jodhpur and the pin drops on the Keru site at about 0:12. No title card | "Residents near a Jodhpur dump took it to the National Green Tribunal. The case closed for want of a statutory rule, and eight months after a two-month deadline, nothing had happened. Saboot turns a map pin into the rule and the proof." | Idea and Impact |
| 0:15–0:45 | Timeline slider from 2019 to 2026, the GIF, the sparkline, "first visible" | "Sentinel-2 from the Registry of Open Data on AWS: this site in every clear month since 2019, newest pass five days ago. It appears in <year> and grows." | Execution, Design |
| 0:45–1:00 | Fire layer and burn calendar with source-type labels | "NASA FIRMS: thermal anomalies near the site, peaking every winter. Hits that look industrial are labelled, and a quiet month does not mean nobody burned." | Execution, candour |
| 1:00–1:35 | Click "शिकायत ड्राफ्ट करें" ("Draft complaint"). Staged progress, then the Hindi draft with a rule card beside each cited sentence, and the addressees | "Code picks the rules, the agent pulls their exact text from the 2026 gazette and writes the complaint in Hindi, addressed to the corporation and to the pollution control board, which must levy compensation under rule 41(4)." | Idea and Impact, Built on AWS |
| 1:35–1:50 | Verifier output, then the evidence pack with SHA-256 hashes and the QR code | "Every quoted clause found word for word in the hashed gazette. Every photo and satellite frame hashed the moment we fetched it." | Execution |
| 1:50–2:05 | Closure check on a simulated case, or the lookalike map with its precision figure | "The ticket says resolved. The next satellite pass says it is still there. One click reopens it with new evidence." | Idea and Impact |
| 2:05–2:35 | Architecture diagram, then two-second console shots: Amplify, the Lambda Function URL, the Bedrock `in.` profile, the Knowledge Base on S3 Vectors, an Athena query, DynamoDB | "Where AWS fits: inference stays in India, rules come from a Knowledge Base, fire history lives in a partitioned data lake that the same job builds for any district." | Built on AWS |
| 2:35–2:50 | Limits card | "Large sites only. FIRMS misses short evening fires. Saboot never names a person, it is not legal advice, and the resident files the complaint." | Execution, candour |
| 2:50–3:00 | Back to the map | "From one dismissed photo to dated evidence, the exact 2026 rule and the right regulator in under <measured> minutes. Next: every district, before the 31 October mapping deadline." | Idea and Impact |

**Production.** Record with a clean microphone and add captions. Keep the code editor off screen.

**Submission checklist.**

- A public repository whose commit history falls inside the event dates.
- A YouTube video of 3:00 or less, public or unlisted, that opens in a signed-out browser.
- A writeup covering:
  - Problem
  - Who it is for
  - What changes
  - Build
  - "Where AWS fits" table
  - Data sources and freshness
  - Limits
  - Every AI tool used. The rules require the full list ([Rules](https://www.wemakedevs.org/aws/rules)).
  - What we learned. Some organizer guides list "what you learned" as a criterion in place of design ([Plan guide](https://www.wemakedevs.org/blogs/how-to-plan-a-cloud-project)).
- A blog post published on AWS Builder Center and linked in the submission. The top five blogs win AirPods ([Event page](https://www.wemakedevs.org/aws/environmental-hacks)).

## Sixteen facts to verify before they reach the video

| Verify | Why it matters | Where | When |
|---|---|---|---|
| Submission deadline hour and time zone | The schedule says the hours "are being finalised" ([Schedule](https://www.wemakedevs.org/aws/env/schedule)) | Schedule page, Discord | Thursday, then daily |
| Which Bedrock profile IDs work from ap-south-1, and whether the free plan blocks Anthropic models | Go or no-go for the agent. The blog and the docs disagree | boto3 `converse` smoke test | First hour |
| That the e-Gazette original of S.O. 388(E) matches the MPCB copy's rule numbers | Citation accuracy and the corpus hash | egazette.gov.in | Thursday |
| Whether MoEFCC or CPCB notified the rule 17(2) compensation guidelines after the 29 September hearing | Whether the draft can mention amounts | LiveLaw, CPCB | Friday |
| The Keru dump polygon and the location of the Central Jail yard | The hero site must actually show change | Esri Wayback plus Sentinel-2 | Thursday |
| RSPCB Jodhpur Regional Office address, email and phone | The details date from 2022 | environment.rajasthan.gov.in | Friday |
| The merged corporation's ward structure, SWM nodal officer, complaint channel and any bye-law fines | Correct addressee | Corporation website | Friday |
| Earth Index model choice (SoftCon or SSL4EO) and the tile footer | Avoid mixing vectors from the two models | One downloaded tile | Thursday |
| A working FIRMS MAP_KEY | Fire data for 2025 and 2026 | FIRMS site | Thursday |
| Formal register of the Hindi drafts | No benchmark exists for legal-register Hindi | A native reader | Saturday |
| Esri Wayback terms for a public web app | Licensing | Esri | Saturday |
| Where the "Big data concepts" line came from | A college requirement would justify keeping the Glue job | The team | Thursday |
| SheerID verification for 2027 and 2028 graduates | The Amazon fast-track depends on it, and verification takes a day or two ([Rules](https://www.wemakedevs.org/aws/rules)) | Builder Center | Thursday |
| Polly Kajal synchronous API, and Amazon Location in ap-south-1 | Add-ons | Console | Saturday |
| Writeup word limit or template | Submission format | Submission form | Saturday |
| Any secondary-source statistic before it goes on a slide (for example, the WRI open-burning share, or Jodhpur's tonnes per day) | Several were seen only in summaries or dated studies | Primary documents | Before recording |

## Conclusion

The research changes what Saboot should claim to be. Detecting dumps from space is well trodden: hackathon and student projects for satellite dump detection keep recurring, and judges will have seen them. Saboot should not lead with detection. It should lead with turning public satellite data into an accountable administrative act: the right regulator, the exact clause, a hash, and a recheck. The deforestation record points the same way. Satellite alerts led to enforcement in Peru once a specific institution with jurisdiction adopted them ([WRI](https://www.wri.org/publication/use-near-real-time-deforestation-alerts)). Addressing RSPCB under rules 41(4) and 17(3) is how Saboot finds its institution.

The format itself favours the narrow, provable version. Judges see only a video and a repo, and the organizers' own guide rewards verification commands, stated limits and rules held in data. Every hour moved from infrastructure (OpenSearch, EMR) to proof (the verifier, the hashes, the closure check) lifts Idea and Impact, Execution and Demo at once. The 31 October deadline for mapping garbage vulnerable points also gives Saboot a credible life after the hackathon: citizen-pinned, satellite-dated sites are exactly the input that local bodies are now legally required to produce.
