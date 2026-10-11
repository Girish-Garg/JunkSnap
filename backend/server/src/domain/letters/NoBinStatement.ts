import { CountNoun } from "../CountNoun.js";
import { ZONE_RADIUS_M } from "../sites/NoBinZone.js";
import type { LetterSite } from "./LetterSite.js";

// Each no-bin report or yes vote says no dustbin within ZONE_RADIUS_M (decision 20261010-1630).

// near: a mapped bin inside the zone; within: one past the zone but inside the radius; none: none mapped within the radius.
type BinKind = "near" | "within" | "none";
type Phrases = Readonly<Record<BinKind, (distance: string) => string>>;

interface BinReading {
  readonly kind: BinKind;
  // Metres for near, kilometres otherwise.
  readonly distance: string;
}

// Hindi nouns before ने take the oblique plural: "3 लोगों ने", but "1 व्यक्ति ने".
const PEOPLE_HI = new CountNoun("व्यक्ति", "लोगों");

const ENGLISH: Phrases = {
  near: (m) => `A mapped bin is ${m} m away (OpenStreetMap, ward records); it may be missing or broken.`,
  within: (km) => `The nearest mapped bin or collection point is ${km} km away (OpenStreetMap, ward records).`,
  none: (km) => `No mapped bin or collection point within ${km} km (OpenStreetMap, ward records).`,
};

const HINDI: Phrases = {
  near: (m) => `नक्शे पर एक कूड़ेदान ${m} मीटर दूर दर्ज है (OpenStreetMap, वार्ड रिकॉर्ड); वह गायब या टूटा हो सकता है।`,
  within: (km) => `नक्शे पर सबसे पास का कूड़ेदान या कचरा संग्रह केंद्र ${km} किलोमीटर दूर दर्ज है (OpenStreetMap, वार्ड रिकॉर्ड)।`,
  none: (km) => `${km} किलोमीटर के भीतर नक्शे पर कोई कूड़ेदान या कचरा संग्रह केंद्र नहीं है (OpenStreetMap, वार्ड रिकॉर्ड)।`,
};

// What a no-bin letter states, in the template and the model prompt alike: who confirmed it, and a mapped bin only as measured.
export class NoBinStatement {
  readonly #binRadiusM: number;

  constructor(binRadiusM: number) {
    this.#binRadiusM = binRadiusM;
  }

  english(site: LetterSite): string {
    const people = `${NoBinStatement.#confirmed(site.backers)} there is no dustbin within 1 km of this spot.`;
    return this.#withBin(people, site, ENGLISH);
  }

  hindi(site: LetterSite): string {
    const people = `${PEOPLE_HI.of(site.backers)} ने पुष्टि की है कि इस जगह के 1 किलोमीटर के भीतर कोई कूड़ेदान नहीं है।`;
    return this.#withBin(people, site, HINDI);
  }

  #withBin(people: string, site: LetterSite, phrases: Phrases): string {
    const reading = this.#reading(site);
    return reading === null ? people : `${people} ${phrases[reading.kind](reading.distance)}`;
  }

  // "None within the radius" only when measured: the nearest bin is farther, or the town's bins hold none at all.
  #reading(site: LetterSite): BinReading | null {
    const { nearestBin, noBinWithin3km } = site.evidence;
    const none: BinReading = { kind: "none", distance: NoBinStatement.#km(this.#binRadiusM) };
    if (nearestBin === null) {
      return noBinWithin3km === true ? none : null;
    }
    const metres = nearestBin.distance_m;
    if (metres <= ZONE_RADIUS_M) {
      return { kind: "near", distance: String(Math.round(metres)) };
    }
    return metres <= this.#binRadiusM ? { kind: "within", distance: NoBinStatement.#km(metres) } : none;
  }

  static #confirmed(people: number): string {
    return people === 1 ? "1 person has confirmed" : `${people} people confirmed`;
  }

  // 3000 m reads "3", 1840 m reads "1.8".
  static #km(metres: number): string {
    return String(Number((metres / 1000).toFixed(1)));
  }
}
