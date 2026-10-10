import type { LetterSite } from "./LetterSite.js";

// Each no-bin report or yes vote says no dustbin within this radius (decision 20261010-1630).
const ZONE_RADIUS_M = 1000;

// What a no-bin letter states, in the template and in the model prompt alike: who confirmed it, and a mapped bin as evidence only.
export class NoBinStatement {
  readonly #binRadiusM: number;

  constructor(binRadiusM: number) {
    this.#binRadiusM = binRadiusM;
  }

  english(site: LetterSite): string {
    const people = `${site.backers} people confirmed there is no dustbin within 1 km of this spot.`;
    const near = this.#mappedNear(site);
    const bin =
      near === null
        ? `No mapped bin or collection point within ${this.#km()} km (OpenStreetMap, ward records).`
        : `A mapped bin is ${near} m away (OpenStreetMap, ward records); it may be missing or broken.`;
    return `${people} ${bin}`;
  }

  hindi(site: LetterSite): string {
    const people = `${site.backers} लोगों ने पुष्टि की है कि इस जगह के 1 किलोमीटर के भीतर कोई कूड़ेदान नहीं है।`;
    const near = this.#mappedNear(site);
    const bin =
      near === null
        ? `${this.#km()} किलोमीटर के भीतर नक्शे पर कोई कूड़ेदान या कचरा संग्रह केंद्र नहीं है (OpenStreetMap, वार्ड रिकॉर्ड)।`
        : `नक्शे पर एक कूड़ेदान ${near} मीटर दूर दर्ज है (OpenStreetMap, वार्ड रिकॉर्ड); वह गायब या टूटा हो सकता है।`;
    return `${people} ${bin}`;
  }

  #km(): string {
    return String(Number((this.#binRadiusM / 1000).toFixed(1)));
  }

  // Metres to a mapped bin inside the zone, or null when none is that close.
  #mappedNear(site: LetterSite): number | null {
    const bin = site.evidence.nearestBin;
    return bin !== null && bin.distance_m <= ZONE_RADIUS_M ? Math.round(bin.distance_m) : null;
  }
}
