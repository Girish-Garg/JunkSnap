# Brand to parent-company map: sources

`brands.json` maps 69 brands common in Indian street litter (packaged food, beverages, tobacco, pan masala, household) to the company that owns them. The brand labeller reads it; each row's `source_url` becomes `brand_label.mapping_source_url`.

- As of: 10 October 2026.
- Licence: compiled by the team from public company and regulator pages. Brand names are trademarks of their owners; the file holds names and links only, no copied page text.

## Shape

`{"as_of": "YYYY-MM-DD", "brands": [{"brand", "aliases": [{"text", "require_exact"}], "parent_company", "category", "source_url"}]}`

- `aliases`: the text to match on a packet. A brand whose name is a common word (Wheel, Tide, Pulse) is matched only through longer phrases printed on its packs ("Active Wheel", "Tide Plus", "Pass Pass Pulse"). No alias belongs to two brands.
- Phrase aliases (for example "Bingo Mad Angles", "Tide Plus") are product names as printed on packs, not taken from the source pages, which only establish the parent company. They have not been checked against pack photos. "Wheel Active" is unconfirmed against a pack; HUL's page uses "Active Wheel" and "Wheel 2 in 1".
- `require_exact`: true for every alias under 6 letters or digits once spaces and punctuation are dropped; it must match with zero edits.
- `category`: `food`, `beverage`, `tobacco`, `pan_masala` or `household`.
- `source_url`: the company or regulator page that ties the brand to `parent_company`.

## How the sources were checked

On 10 October 2026 a script fetched every `source_url` and looked for the brand name on the page. Pages that refuse scripts (nestle.in, hul.co.in) and the JavaScript-only RCDF page were opened in a browser instead. The PepsiCo Form 10-K was read directly: Item 1, AMESA paragraph on page 4 lists Kurkure, Lay's, 7UP, Aquafina, Mirinda, Mountain Dew, Pepsi and Sting Energy. Some sites start refusing repeated scripted fetches (the 10-K host and marico.com did on a re-run), so a 403 from a script is not by itself a dead link.

| Parent company | Source | Brands |
|---|---|---|
| The Coca-Cola Company | https://www.coca-cola.com/in/en/brands (one page per brand) | Coca-Cola, Thums Up, Sprite, Fanta, Limca, Maaza, Kinley |
| PepsiCo, Inc. | https://www.pepsico.com/brands/lays, https://www.pepsico.com/brands/pepsi | Lay's, Pepsi |
| PepsiCo, Inc. | Form 10-K for 2024: https://investor.pepsico.com/docs/default-source/investors/q4-2024/q4-2024-form-10k_kgcva0jf89d2927o.pdf | Kurkure, Mountain Dew, 7UP, Mirinda, Aquafina, Sting |
| Parle Agro Private Limited | https://www.parleagro.com/brand/5, https://www.parleagro.com/brand/10 | Frooti, Appy Fizz |
| Bisleri International Private Limited | https://www.bisleri.com/ | Bisleri |
| Hector Beverages Private Limited | https://www.hectorbeverages.com/ | Paper Boat |
| Reliance Consumer Products Limited | RIL press release, 1 Sep 2023: https://www.ril.com/news-media/press-releases/reliance-consumer-products-limited-launches-campa-cricket-infused | Campa |
| ITC Limited | https://itcportal.com/itc-businesses/fmcg/food.html | Bingo, Sunfeast, Yippee, Candyman |
| ITC Limited | https://itcportal.com/itc-businesses/fmcg/cigarette.html | Gold Flake, Wills Navy Cut |
| Bikaji Foods International Limited | https://www.bikaji.com/ | Bikaji |
| Prataap Snacks Limited | https://www.yellowdiamond.in/ | Yellow Diamond |
| Balaji Wafers Private Limited | https://www.balajiwafers.com/ | Balaji Wafers |
| Parle Products Private Limited | https://www.parleproducts.com/brands/parle-g, .../parle-krack-jack, .../melody, https://www.parleproducts.com/parle-brands | Parle-G, Krack Jack, Melody, Hide & Seek |
| Britannia Industries Limited | https://www.britannia.co.in/brands | Britannia, Good Day, 50-50 |
| Nestlé India Limited | https://www.nestle.in/brands (one page per brand) | Maggi, KitKat, Munch, Nescafé |
| Mondelez International | https://www.mondelezinternational.com/our-brands/ (and its 5-star, cadbury-dairy-milk pages) | Cadbury, Dairy Milk, 5 Star |
| DS Group | https://www.dsgroup.com/our-brand/... (one page per brand) | Pulse, Pass Pass, Rajnigandha |
| Perfetti Van Melle India | https://www.perfettivanmelle.in/ourbrands/... (one page per brand) | Center Fresh, Center Fruit, Mentos |
| Gujarat Cooperative Milk Marketing Federation Ltd | https://amul.com/ | Amul |
| Mother Dairy Fruit & Vegetable Private Limited | https://www.motherdairy.com/ | Mother Dairy |
| Rajasthan Co-operative Dairy Federation Limited | Government of Rajasthan portal: https://sarasmilkfed.rajasthan.gov.in/ | Saras |
| Hindustan Unilever Limited | https://www.hul.co.in/brands/... (one page per brand) | Brooke Bond Red Label, Surf Excel, Rin, Wheel, Lifebuoy, Clinic Plus, Sunsilk |
| Tata Consumer Products Limited | https://www.tataconsumer.com/our-offerings | Tata Tea |
| Godfrey Phillips India Limited | https://www.godfreyphillips.co.in/company/cigarette | Four Square, Red & White |
| Procter & Gamble India | https://in.pg.com/brands/ | Tide, Ariel, Head & Shoulders |
| RSPL Limited | https://www.rsplgroup.com/ | Ghadi |
| Nirma Limited | https://nirma.co.in/ | Nirma |
| Marico Limited | https://marico.com/india/brands | Parachute |
| Patanjali Ayurved Limited | https://www.patanjaliayurved.net/ | Patanjali |

## Devanagari spellings

Six brands carry a Hindi spelling. All six are unverified: none has been checked against a pack photo yet. Rekognition DetectText reads Latin script only, so these aliases help only a reader that handles Hindi (an LLM step or a Hindi OCR).

| Brand | Devanagari alias | Status |
|---|---|---|
| Amul | अमूल | unverified |
| Mother Dairy | मदर डेयरी | unverified |
| Parle-G | पारले-जी, पारले जी | unverified |
| Bikaji | बीकाजी | unverified |
| Rajnigandha | रजनीगंधा | unverified |
| Patanjali | पतंजलि | unverified |

## Left out on purpose

- Bare common words, replaced by longer phrases printed on the packs: Bingo, Melody, Good Day, Munch, Five Star, Pulse, Wheel, Tide, "Dairy Milk" (it would match "Mother Dairy Milk Shake"; "Cadbury Dairy Milk" stays), and "Clinic" (what "Clinic+" becomes once punctuation is dropped). They would match ordinary packet text such as "Pulses", "Slices" or "Lunch" within one edit.
- Hindi words that are also everyday words: सरस (Saras, "juicy") and घड़ी / घडी (Ghadi, "clock"). Saras and Ghadi are matched only in Latin script.
- Slice: no PepsiCo page or filing that names it could be opened (pepsicoindia.co.in blocked both the script and the browser used here, and the 10-K does not list it).
- Other generic words that appear on other packets: Classic (ITC; "Classic Salted" chips), Real (Dabur), Tiger and Bourbon (Britannia; bourbon is a biscuit type), Catch (DS Group spices), Baba and Tulsi (DS Group chewing tobacco; common in shop names).
- Names shared by different owners: Taaza (Brooke Bond and Amul), "Red Label" alone (also a whisky), "Navy Cut" alone (ITC and Godfrey Phillips), "Parle" alone (Parle Products and Parle Agro are separate companies), "Balaji" alone (many unrelated firms), Haldiram's (used by separately owned companies in Delhi, Nagpur and Kolkata).
- No company or regulator page found: Kamla Pasand and Vimal pan masala, Uncle Chipps, Tropicana in India.
