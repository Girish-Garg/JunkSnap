# Representative and local body sources

Offices and seats only: no names and no party, anywhere (decision 20261010-0137). As of 2026-10-10.

| File | Holds | Source | Licence |
|---|---|---|---|
| `rajasthan_mla_seats.json` | 200 rows `{office: "mla", seat_id: "s20-ac-<n>", as_of, source}`, one per seat in `../boundaries/rajasthan_assembly.geojson` | Rajasthan Legislative Assembly, <https://assembly.rajasthan.gov.in/> (members by constituency) | Facts about offices and seats; the source's terms are at the linked site |
| `india_mp_seats.json` | 543 rows `{office: "mp", seat_id: "<eci-state>-pc-<n>", as_of, source}`, one per seat in `../boundaries/india_loksabha.geojson` | Lok Sabha members, <https://sansad.in/ls/members> | Facts about offices and seats; the source's terms are at the linked site |
| `local_bodies.json` | Urban local bodies JunkSnap can address: `id`, `name`, `head_office`, `state`, `towns`, `wards`, `ward_map`, `note`, `as_of`, `source` | below | Facts about offices; the sources' terms are at the linked sites |

Each row in the two seat files is exactly a `location_lookup.representatives` item, so it can be copied as is.

## Local bodies

- `jodhpur-mc`, Jodhpur Municipal Corporation. Jodhpur North and Jodhpur South were merged in November 2025 (<https://www.thestatesman.com/india/rajasthan-merges-twin-municipal-corporations-in-jaipur-jodhpur-and-kota-into-single-integrated-bodies-1503510026.html>). The count of 100 wards comes from a news report (<https://zeenews.india.com/hindi/india/rajasthan/jodhpur/state-government-approved-proposal-for-municipal-corporation-in-jodhpur/1758197513018>) and is unverified until the gazette notification is found. Departments: Local Self Government, <https://lsg.rajasthan.gov.in/>; State Election Commission, <https://sec.rajasthan.gov.in/>.
- `jaipur-mc`, Jaipur Municipal Corporation, 150 wards. Jaipur Heritage and Jaipur Greater were merged on 10 November 2025. Source: <https://www.theweek.in/wire-updates/national/2025/11/11/des109-rj-municipal-corporation.html> (PTI).
- `head_office` is Commissioner, the executive head who receives the letter.
- `towns` are the Amazon Location `Address.Locality` values that map to the body. A locality can reach past municipal limits; without a municipal boundary map the town is the best key available.
- `ward_map` is null: no open map of the 2025 wards exists (see `../boundaries/SOURCES.md`), so there are no councillor rows yet.
