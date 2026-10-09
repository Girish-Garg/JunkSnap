# Rules: official texts, quotes and letter routing

Data for the letters feature (issue #22). Letter code picks quotes from `rules.json` and addressees from `routing.json`; it never types rule text itself.

| File | Holds |
|---|---|
| `texts/*.txt` | Excerpts of the official texts: only the PDF pages the rules quote, each under a `=== PDF page N ===` line |
| `rules.json` | `texts`: one entry per stored text with its SHA-256, the PDF's URL and SHA-256. `rules`: one entry per quotable clause |
| `routing.json` | Who each letter channel goes to, by report type and state |

Check everything with `uv run scripts/check_rules.py`: every stored text must match its `text_sha256`, and every `exact_text` must appear word for word on its `page`. Runs of whitespace (line breaks from the PDF) count as one space; nothing else is normalised.

**Every rule is `review_status: "unreviewed"`. A person must check each `rules.json` entry and `routing.json` against the PDFs before the demo, then set `checked`.**

## Sources

All fetched on 10 October 2026. `page` is the page number in the downloaded PDF.

| Text | Source URL | PDF SHA-256 | PDF pages kept | Stored text SHA-256 |
|---|---|---|---|---|
| Solid Waste Management Rules, 2026, S.O. 388(E), 27 January 2026, in force 1 April 2026 (Gazette CG-DL-E-28012026-269620) | https://egazette.gov.in/WriteReadData/2026/269620.pdf | `4963ee304d0e6d69097a35036243c27a6cb5548c9d12338d999ab18c63d81591` | 78, 79, 84, 92, 102, 103, 104, 111, 112 | `95a57da888c259dd9fba76c62ea2603b5bc9f18d0f38c45c01e5aeca7c262eaa` |
| Plastic Waste Management (Amendment) Rules, 2026, G.S.R. 237(E), 31 March 2026 (Gazette 271465) | https://egazette.gov.in/WriteReadData/2026/271465.pdf | `9d36c687d5e4ed9f1a2bc26f8477a2eda6e0b8080be83cbb39d700b4a7e517de` | 9, 10, 12 | `44da793550b08465acca1d8b2b01a96eade31a9bec93b5f24007ed24ecc5e180` |
| Water (Prevention and Control of Pollution) Act, 1974 (6 of 1974), consolidated text | https://cpcb.gov.in/upload/home/water-pollution/WaterAct-1974.pdf | `cd83eb5a28b58d2ffbc6613011d792e2c39372bb711cd5a093a7e6d5a24cf076` | 1, 17 | `8280bf4323e7d3db433c6fbfe9e6c224e5a7ef1f104e129ec86f789299c48deb` |
| Environment (Construction and Demolition) Waste Management Rules, 2025, G.S.R. 219(E), 2 April 2025, in force 1 April 2026 (Gazette CG-DL-E-05042025-262313) | https://egazette.gov.in/WriteReadData/2025/262313.pdf | `201e29b8d1c3aba64c41c95fcacc3aa82c7bc201135d3242d6471c7a73a5a184` | 19, 25, 28, 29 | `70192a735f85dda924e44fccd023e50d8b6dd7fd4f674e06dd62415a9898b423` |
| CPCB Guidelines on Dust Mitigation Measures in Handling Construction Material and C&D Wastes, CUPS/89/2017-18, November 2017 | https://cpcb.gov.in/openpdffile.php?id=UmVwb3J0RmlsZXMvNTYxXzE1MTE5MzMzNzJfbWVkaWFwaG90bzEyNjcxLnBkZg== | `dbcbdfa6ca48171fa568b38560d1e4cdb012f5cb23791eca49f311f5aa173928` | 1, 12, 13, 14, 15 | `e57a0d4cbe58803f9c400635237806b349cfd6026bc07a07cc7d1f022a0b0c63` |

Notes:

- SWM Rules 2026: the e-Gazette PDF is byte-identical to CPCB's copy, https://cpcb.gov.in/uploads/MSW/SWM_2026.pdf (same SHA-256).
- C&D Rules 2025: the e-Gazette PDF is byte-identical to CPCB's copy, https://cpcb.gov.in/uploads/hwmd/C&D_rules_2025.pdf.
- Plastic amendment: quotes come from the amendment itself (new rule 12(3A) and the substituted Schedule II paragraph 7.2(d)(i) of the 2016 Rules). The 2016 principal rules are not stored.
- Water Act: India Code (https://indiacode.nic.in/bitstream/123456789/15429/1/the_water_(prevention_and_control_of_pollution)_act,_1974.pdf) returned HTTP 504 twice, so the stored text comes from CPCB's copy of the consolidated Act. In section 24(1)(a), `3[stream or well or sewer or on land]` is the consolidated text's amendment marker (footnote 3: substituted by Act 53 of 1988); it stays in the quote because quotes are word for word. The Water (Prevention and Control of Pollution) Amendment Act, 2024 (CPCB copy https://cpcb.gov.in/upload/home/water-pollution/Amendment_Water_Act-1974.pdf, SHA-256 `ce39d0e51a65ace34edca82c6c408956920dfc8df570f38a6ced3250862f8a65`) replaces the penalty sections, including section 43 for section 24, but does not change the wording of section 24. It is not stored.
- Dust guidelines: listed on https://cpcb.gov.in/technical-guidelines-5/. CPCB serves the file with 130 bytes of HTML before the PDF; `source_sha256` is of the response exactly as downloaded, and the PDF inside it (from byte 131) has SHA-256 `a81511882c2b5c63b65a27a92d52b0dd7c6d123fd2e0df1030e304832b153d2f`. Printed page numbers are 2 lower than PDF pages.
- Hindi: the Gazette PDFs are bilingual, but their Hindi text layer does not extract to correct Unicode, so no Hindi text is stored and every quote is in the official English.
- Licence: official Government of India publications; the sources state no licence. Only the excerpts needed for citation are stored.

## How the texts were made

`pdftotext -enc UTF-8` (Xpdf 4.00, default reading order) on each downloaded PDF, keeping only the listed pages. Trailing spaces on each line and blank lines at the start and end of each page were removed. On the first English page of each Gazette notification (SWM page 78, plastic page 9, C&D page 19), the lines before "MINISTRY OF ENVIRONMENT, FOREST AND CLIMATE CHANGE" were dropped: they hold the end of the Hindi text and the signatory line, and no person is named in this folder.

## Fields

`rules.json` rules: `rule_id`, `document`, `clause`, `exact_text`, `page`, `language`, `text_file`, `source_url`, `source_sha256`, `situation_tags`, `channels`, `review_status`.

- `situation_tags`: report types and contexts from `contracts/schemas/site.schema.json`, plus `burning` (site.burning) and `packaging` (site.brands is not empty). A rule fits a site when a tag matches.
- `channels`: the `letter_draft.channel` values whose letters may cite the rule.

`routing.json`: Cc the councillor (only when the site has a ward), MLA and MP "for attention" on every channel. A channel applies when the site's report type is in `report_types`, or `or_burning` is true and the site is burning, and the state is in `states` (`null` means every state). `requires_local_body` channels need `site.location.local_body`. `state_bodies` overrides the default body name for a state.
