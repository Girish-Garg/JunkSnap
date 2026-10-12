---
status: accepted
superseded_by:
area: contracts
by: hem
date: 2026-10-10T02:02+05:30
---
# Models report what the waste is, not only whether it exists

Context: a yes/no verdict tells a city little about what to send or where the risk is. Confirmed in chat on 10 Oct.

Decision:
- Per report (`verification_result.insights`, from `ml`): composition shares by material (plastic, organic, construction debris, paper, glass, metal, textile, e-waste, medical), each with the model that estimated it; a size class small, medium or large, never tonnage; hazards (burning or smoke, medical waste, e-waste, dead animal, chemicals).
- Per site (`site.insights`, merged by the worker): the same three, plus sensitive places within 100 m (school, hospital, water body, open drain) from the ward crawler's OpenStreetMap layers.
- Per area (`ward_scores.insights`, from `scores`): composition shares, share of hazardous sites, top brands by count (readable labels only), repeat spots, report hour and day pattern, sites near schools or water.
- Only measured numbers. Every insight says where it came from: per report the model (provider, model, version); per site the models and report counts; nearby places their OpenStreetMap layer source; per area the counts it rests on, plus the models behind area composition. Area shares follow the 10-verified-report guardrail.

Consequences for other lanes: additive contract fields with fixtures (this PR); A5 builds the ML side, D2 the nearby places, D3 the site merge, D4 the area insights, F4 shows them.

Rejected alternatives: yes/no only; tonnage estimates; insights written by the LLM without a measured source.
