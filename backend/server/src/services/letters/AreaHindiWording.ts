import type { AreaKind, AreaRef } from "../../domain/AreaKey.js";
import type { AreaIssue } from "../../domain/letters/AreaIssueSites.js";
import type { CcLine, Recipient } from "../../domain/letters/types.js";
import type { AreaLetterBrief } from "../../ports/letters/AreaLetterWriter.js";
import type { AreaEvidence, AreaWording, WorstSite } from "./AreaTemplateLetter.js";
import { joinList, kilometres, letterDate } from "./utils.js";

const KIND: Readonly<Record<AreaKind, (name: string) => string>> = {
  ward: (name) => name,
  assembly: (name) => `${name} विधानसभा क्षेत्र`,
  loksabha: (name) => `${name} लोकसभा क्षेत्र`,
  district: (name) => `${name} ज़िला`,
};

// Phrases avoid case endings, so each fits after "यह सूचना दी है:".
const ISSUE: Readonly<Record<AreaIssue, string>> = {
  waste_dump: "कचरे के ढेर",
  no_bin: "कूड़ेदान की कमी वाले स्थान",
  contaminated_water: "दूषित पानी और नालियाँ",
  open_construction: "खुला निर्माण मलबा और धूल",
  overflowing_bin: "भरे या टूटे कूड़ेदान",
  all: "कचरा स्थल",
};

const REQUEST: Readonly<Record<AreaIssue, string>> = {
  waste_dump: "अनुरोध है कि इन स्थलों से कचरा हटवाया जाए और जहाँ कमी है वहाँ कूड़ेदान या कचरा संग्रह केंद्र की व्यवस्था की जाए।",
  no_bin: "अनुरोध है कि इन स्थानों पर कूड़ेदान लगाए जाएँ और नियमित कचरा संग्रह की व्यवस्था की जाए।",
  contaminated_water: "अनुरोध है कि इन स्थलों के पानी और नालियों की सफ़ाई कराई जाए और प्रदूषण के स्रोतों की जाँच की जाए।",
  open_construction: "अनुरोध है कि इन स्थलों के मलबे को ढका या हटाया जाए और धूल नियंत्रण के उपाय लागू कराए जाएँ।",
  overflowing_bin: "कृपया इन कूड़ेदानों को नियमित रूप से खाली कराएँ और उनकी मरम्मत कराएँ या उन्हें बदलवाएँ।",
  all: "अनुरोध है कि सूचित स्थलों को साफ़ कराया जाए और उनके कारणों का समाधान किया जाए।",
};

const STATUS: Readonly<Record<WorstSite["status"], string>> = { open: "खुला", reopened: "फिर से खुला", cleaned: "साफ़ किया गया" };
const OFFICE: Readonly<Record<CcLine["office"], string>> = { councillor: "के पार्षद", mla: "के विधायक", mp: "के सांसद" };
const SCORE: Readonly<Record<string, string>> = { city: "शहर", citizen: "नागरिक", bin_access: "कूड़ेदान पहुँच" };
const SIZE: Readonly<Record<string, string>> = { small: "छोटा", medium: "मध्यम", large: "बड़ा" };
const PLACE: Readonly<Record<string, string>> = { school: "स्कूल", hospital: "अस्पताल", water: "जल स्रोत", drain: "नाला" };

export class AreaHindiWording implements AreaWording {
  readonly language = "hi";
  readonly #binRadiusM: number;

  constructor(binRadiusM = 3000) {
    this.#binRadiusM = binRadiusM;
  }

  static areaName(area: AreaRef): string {
    return KIND[area.kind](area.name);
  }

  subject(brief: AreaLetterBrief): string {
    return `अनुरोध: ${AreaHindiWording.areaName(brief.area)} में ${ISSUE[brief.issue]} (JunkSnap क्षेत्र रिपोर्ट)`;
  }

  opening(to: readonly Recipient[]): string {
    return ["सेवा में,", ...to.map((recipient) => `${recipient.office}, ${recipient.body}`)].join("\n");
  }

  facts(brief: AreaLetterBrief): string {
    const { reports, reporters, verified_reports, sites, first_reported_at } = brief.evidence;
    const people = reporters === null ? "" : ` (${reporters} लोगों द्वारा)`;
    const since = letterDate(first_reported_at, "hi-IN");
    return `निवासियों ने ${AreaHindiWording.areaName(brief.area)} में यह सूचना दी है: ${ISSUE[brief.issue]}। ${since} से अब तक ${sites} स्थलों पर ${reports} रिपोर्ट${people}, जिनमें ${verified_reports} सत्यापित हैं।`;
  }

  worstSites(sites: readonly WorstSite[]): string {
    const lines = sites.map((site) => {
      const photos = site.photo_urls.length > 0 ? ` धुंधली की गई तस्वीरें: ${site.photo_urls.join(" ")}` : "";
      const since = letterDate(site.first_reported_at, "hi-IN");
      return `- ${site.site_id}: ${site.verified_count}/${site.report_count} सत्यापित रिपोर्ट, ${since} से ${STATUS[site.status]}।${AreaHindiWording.#insights(site)}${photos}`;
    });
    return ["सबसे अधिक सत्यापित रिपोर्ट वाले स्थल:", ...lines].join("\n");
  }

  measured(evidence: AreaEvidence): string | null {
    const lines: string[] = [];
    const [first] = evidence.scores;
    if (first !== undefined) {
      const values = evidence.scores.map((score) => `${SCORE[score.name] ?? score.name} ${score.value}`);
      lines.push(`मापे गए क्षेत्र स्कोर (0 से 100, अधिक बेहतर), ${first.verified_reports} सत्यापित रिपोर्ट पर आधारित: ${joinList(values, "और")}।`);
    }
    const bins = evidence.bin_access;
    if (bins !== null && bins.sites_measured > 0) {
      const km = kilometres(this.#binRadiusM);
      lines.push(`मापे गए ${bins.sites_measured} स्थलों में से ${bins.sites_without_bin_within_3km} के ${km} किमी के भीतर कोई ज्ञात कूड़ेदान या संग्रह केंद्र नहीं है।`);
    }
    return lines.length === 0 ? null : lines.join("\n");
  }

  static #insights(site: WorstSite): string {
    const measured = site.insights;
    if (measured === null) {
      return "";
    }
    const parts = [
      ...measured.composition.slice(0, 2).map((share) => `${share.material} लगभग ${Math.round(share.share_pct)}% (${share.reports} रिपोर्ट)`),
      ...(measured.size_class === null ? [] : [`${SIZE[measured.size_class] ?? measured.size_class} ढेर`]),
      ...measured.near.map((place) => `${PLACE[place.kind] ?? place.kind} ${Math.round(place.distance_m)} मीटर के भीतर`),
    ];
    return parts.length === 0 ? "" : ` मापा गया: ${parts.join("; ")}।`;
  }

  rulesIntro(): string {
    return "संबंधित प्रावधान (आधिकारिक अंग्रेज़ी पाठ):";
  }

  request(brief: AreaLetterBrief): string {
    return REQUEST[brief.issue];
  }

  closing(cc: readonly CcLine[]): string {
    const copies = cc.map((line) => `${line.seat.name} ${OFFICE[line.office]}`);
    const filed = "यह पत्र एक निवासी द्वारा भेजा जा रहा है।";
    return copies.length === 0 ? filed : `${filed} प्रतिलिपि सूचनार्थ: ${joinList(copies, "और")}।`;
  }
}
