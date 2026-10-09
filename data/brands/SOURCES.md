# Brand to parent-company map: sources

`brands.json` maps 70 brands common in Indian street litter (packaged food, beverages, tobacco, pan masala, household) to the company that owns them. The brand labeller reads it; each row's `source_url` becomes `brand_label.mapping_source_url`.

- As of: 10 October 2026.
- Licence: compiled by the team from public company and regulator pages. Brand names are trademarks of their owners; the file holds names and links only, no copied page text.

## Shape

`{"as_of": "YYYY-MM-DD", "brands": [{"brand", "aliases", "parent_company", "category", "source_url"}]}`

- `aliases`: every spelling to match, including the brand itself. No alias belongs to two brands.
- `category`: `food`, `beverage`, `tobacco`, `pan_masala` or `household`.
- `source_url`: the company or regulator page that ties the brand to `parent_company`.

## How the sources were checked

On 10 October 2026 a script fetched every `source_url` and looked for the brand name on the page. Pages that refuse scripts (nestle.in, hul.co.in) and the JavaScript-only RCDF page were opened in a browser instead. The PepsiCo Form 10-K was read directly: Item 1, AMESA paragraph on page 4 lists Kurkure, Lay's, 7UP, Aquafina, Mirinda, Mountain Dew, Pepsi and Sting Energy.

| Parent company | Source | Brands |
|---|---|---|
| The Coca-Cola Company | https://www.coca-cola.com/in/en/brands (one page per brand) | Coca-Cola, Thums Up, Sprite, Fanta, Limca, Maaza, Kinley |
| PepsiCo, Inc. | https://www.pepsico.com/brands/lays, https://www.pepsico.com/brands/pepsi | Lay's, Pepsi |
| PepsiCo, Inc. | Form 10-K for 2024: https://investor.pepsico.com/docs/default-source/investors/q4-2024/q4-2024-form-10k_kgcva0jf89d2927o.pdf | Kurkure, Mountain Dew, 7UP, Mirinda, Aquafina, Sting |
| PepsiCo, Inc. | Varun Beverages (PepsiCo's bottler), "Brands owned by PepsiCo": https://www.varunbeverages.com/our-products/ | Slice |
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
| DS Group (Dharampal Satyapal Group) | https://www.dsgroup.com/our-brand/... (one page per brand) | Pulse, Pass Pass, Rajnigandha |
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

Eight brands also carry the Hindi spelling printed on their Hindi-market packs. Saras (सरस) and Ghadi (घड़ी) appear on their source sites. Amul, Mother Dairy, Parle-G, Bikaji, Rajnigandha and Patanjali are not yet checked against a pack photo. घडी is the same word without the nukta, which OCR and keyboards often drop. Rekognition DetectText reads Latin script only, so these aliases help only a reader that handles Hindi (an LLM step or a Hindi OCR).

## Left out on purpose

- Generic words that appear on other packets: Classic (ITC; "Classic Salted" chips), Real (Dabur), Tiger and Bourbon (Britannia; bourbon is a biscuit type), Catch (DS Group spices), Baba and Tulsi (DS Group chewing tobacco; common in shop names).
- Names shared by different owners: Taaza (Brooke Bond and Amul), "Red Label" alone (also a whisky), "Navy Cut" alone (ITC and Godfrey Phillips), "Parle" alone (Parle Products and Parle Agro are separate companies), "Balaji" alone (many unrelated firms), Haldiram's (used by separately owned companies in Delhi, Nagpur and Kolkata).
- No company or regulator page found: Kamla Pasand and Vimal pan masala, Uncle Chipps, Tropicana in India.
