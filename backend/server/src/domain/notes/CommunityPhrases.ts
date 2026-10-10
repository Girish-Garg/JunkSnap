import { flagged, SIGNAL_FLAGS, type CommunitySignals, type SignalFlag } from "./Community.js";

type Language = "en" | "hi";

const FLAG_PHRASES: Readonly<Record<Language, Readonly<Record<SignalFlag, string>>>> = {
  en: {
    recurring: "it comes back after clearing",
    burning: "it is burnt, with smoke",
    smell: "there is a bad smell",
    blocked_drain: "a drain is blocked or water stands",
    animals: "it draws stray animals or pests",
    near_school: "a school is nearby",
    near_hospital: "a hospital is nearby",
    access_issue: "it blocks a road, lane or path",
  },
  hi: {
    recurring: "सफ़ाई के बाद यह फिर लौट आता है",
    burning: "इसे जलाया जाता है और धुआँ उठता है",
    smell: "तेज़ बदबू आती है",
    blocked_drain: "नाली बंद है या पानी रुका रहता है",
    animals: "आवारा पशु या कीड़े-मकोड़े आते हैं",
    near_school: "पास में स्कूल है",
    near_hospital: "पास में अस्पताल है",
    access_issue: "यह सड़क, गली या रास्ता रोकता है",
  },
};

const MENTIONS: Readonly<Record<Language, Readonly<Record<SignalFlag, string>>>> = {
  en: {
    recurring: "returns after clearing",
    burning: "burning or smoke",
    smell: "a bad smell",
    blocked_drain: "a blocked drain or standing water",
    animals: "stray animals or pests",
    near_school: "a school nearby",
    near_hospital: "a hospital nearby",
    access_issue: "a blocked road or path",
  },
  hi: {
    recurring: "सफ़ाई के बाद फिर लौटना",
    burning: "जलाना या धुआँ",
    smell: "बदबू",
    blocked_drain: "बंद नाली या रुका पानी",
    animals: "आवारा पशु या कीड़े",
    near_school: "पास में स्कूल",
    near_hospital: "पास में अस्पताल",
    access_issue: "रास्ता रुकना",
  },
};

export interface AreaMention {
  readonly signal: SignalFlag;
  readonly sites: number;
}

// Neutral phrases from structured signals, written by code so a letter never carries a resident's own words.
export class CommunityPhrases {
  readonly #language: Language;

  constructor(language: Language) {
    this.#language = language;
  }

  phrases(signals: CommunitySignals): string[] {
    const duration = this.#duration(signals.duration_days);
    const flags = SIGNAL_FLAGS.filter((flag) => flagged(signals, flag)).map((flag) => FLAG_PHRASES[this.#language][flag]);
    return duration === null ? flags : [duration, ...flags];
  }

  // "From 4 residents: it has been here about 3 months; it is burnt, with smoke."
  line(people: number, signals: CommunitySignals): string {
    const phrases = this.phrases(signals);
    if (this.#language === "hi") {
      const said = phrases.length === 0 ? "नोट जोड़े गए, कोई ख़ास समस्या नहीं बताई गई" : phrases.join("; ");
      return `${people} निवासियों के अनुसार: ${said}।`;
    }
    const said = phrases.length === 0 ? "notes added, no specific problem named" : phrases.join("; ");
    return `From ${people} ${people === 1 ? "resident" : "residents"}: ${said}.`;
  }

  // The letters' "Residents report" line: "Residents report (4 people): it has been here about 3 months; ..."
  report(people: number, signals: CommunitySignals): string {
    const phrases = this.phrases(signals);
    if (this.#language === "hi") {
      const said = phrases.length === 0 ? "नोट जोड़े गए" : phrases.join("; ");
      return `निवासियों की सूचना (${people} लोग): ${said}।`;
    }
    const said = phrases.length === 0 ? "notes added, no specific problem named" : phrases.join("; ");
    return `Residents report (${people} ${people === 1 ? "person" : "people"}): ${said}.`;
  }

  // "Residents report at 2 of these sites (6 people): burning or smoke at 2 sites; a bad smell at 1 site."
  areaReport(sites: number, people: number, mentions: readonly AreaMention[]): string {
    const words = MENTIONS[this.#language];
    if (this.#language === "hi") {
      const said = mentions.map((mention) => `${words[mention.signal]} (${mention.sites} स्थल)`).join("; ");
      return `${sites} स्थलों पर निवासियों की सूचना (${people} लोग)${said === "" ? "" : `: ${said}`}।`;
    }
    const said = mentions.map((mention) => `${words[mention.signal]} at ${mention.sites} ${mention.sites === 1 ? "site" : "sites"}`).join("; ");
    const who = `${people} ${people === 1 ? "person" : "people"}`;
    return `Residents report at ${sites} of these sites (${who})${said === "" ? "" : `: ${said}`}.`;
  }

  #duration(days: number | null): string | null {
    if (days === null) {
      return null;
    }
    const [count, unit] = days >= 60 ? [Math.round(days / 30), "months"] : days >= 14 ? [Math.round(days / 7), "weeks"] : [days, "days"];
    if (this.#language === "hi") {
      const hindi: Readonly<Record<string, string>> = { months: "महीने", weeks: "हफ़्ते", days: "दिन" };
      return `यह लगभग ${count} ${hindi[unit] ?? unit} से है`;
    }
    return `it has been here about ${count} ${unit}`;
  }
}
