import type { PlaceFields } from "../../src/domain/location/Place.js";

export const PLACES = {
  jodhpur: { countryCode: "IN", state: "Rajasthan", district: "Jodhpur", town: "Jodhpur" },
  jaipur: { countryCode: "IN", state: "Rajasthan", district: "Jaipur", town: "Jaipur" },
  delhi: { countryCode: "IN", state: "Delhi", district: "New Delhi", town: "New Delhi" },
  leh: { countryCode: "IN", state: "Ladakh", district: "Leh", town: "Leh" },
  kathmandu: { countryCode: "NP", state: "Bagmati", district: "Kathmandu", town: "Kathmandu" },
  sangaria: { countryCode: "IN", state: "Rajasthan", district: "Hanumangarh", town: "Sangaria" },
  abohar: { countryCode: "IN", state: "Punjab", district: "Fazilka", town: "Abohar" },
} as const satisfies Record<string, PlaceFields>;

// The contract fixtures' sample points, with the seats data/boundaries puts them in.
export const SAMPLES = [
  { sample: "jdh-1", lat: 26.2618, lon: 73.0035, place: PLACES.jodhpur, assembly: "s20-ac-128", loksabha: "s20-pc-16" },
  { sample: "jdh-2", lat: 26.3049, lon: 73.0352, place: PLACES.jodhpur, assembly: "s20-ac-127", loksabha: "s20-pc-16" },
  { sample: "jdh-3", lat: 26.2701, lon: 73.0458, place: PLACES.jodhpur, assembly: "s20-ac-127", loksabha: "s20-pc-16" },
  { sample: "jpr-1", lat: 26.853, lon: 75.8156, place: PLACES.jaipur, assembly: "s20-ac-54", loksabha: "s20-pc-7" },
] as const;

export const DELHI = { lat: 28.6315, lon: 77.2167 } as const;
export const LEH = { lat: 34.1526, lon: 77.5771 } as const;
export const KATHMANDU = { lat: 27.7172, lon: 85.324 } as const;

// Real-file trouble spots: slivers between seats near Jaipur and Churu, and Punjab's Firozepur overlapping Sangaria.
export const JAIPUR_SLIVER = { lat: 26.95, lon: 75.7314 } as const;
export const CHURU_SLIVER = { lat: 27.5, lon: 74.2 } as const;
export const SANGARIA_OVERLAP = { lat: 29.95, lon: 74.39 } as const;
