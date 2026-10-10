import type { LetterSite } from "../../domain/letters/LetterSite.js";
import type { CcLine, Recipient, ReportType, SiteContext } from "../../domain/letters/types.js";
import { NoBinStatement } from "../../domain/letters/NoBinStatement.js";
import type { TemplateWording } from "./TemplateLetter.js";
import { coordinates, joinList, letterDate } from "./utils.js";

const WHAT: Readonly<Record<SiteContext, string>> = {
  vacant_plot: "खाली प्लॉट पर कचरे का ढेर",
  roadside: "सड़क किनारे कचरे का ढेर",
  drain: "नाली में डाला गया कचरा",
  other: "कचरे का ढेर",
  no_bin: "कूड़ेदान की कमी",
  no_pickup: "कचरा न उठाए जाने की समस्या",
  stagnant: "रुका हुआ दूषित पानी",
  sewage: "सीवेज का बहाव",
  foam: "झाग वाला दूषित पानी",
  choked_drain: "बंद नाली",
  uncovered_debris: "खुला पड़ा निर्माण मलबा",
  dusty_site: "धूल भरा निर्माण स्थल",
  overflowing: "भरा हुआ कूड़ेदान, आसपास फैला कचरा",
  damaged: "टूटा, जला या बिना ढक्कन का कूड़ेदान",
};

const REQUEST: Readonly<Record<ReportType, string>> = {
  waste_dump: "अनुरोध है कि इस स्थान से कचरा हटवाया जाए और पास में कूड़ेदान या कचरा संग्रह केंद्र की व्यवस्था की जाए।",
  no_bin: "अनुरोध है कि यहाँ कूड़ेदान लगाए जाएँ और नियमित कचरा संग्रह की व्यवस्था की जाए।",
  contaminated_water: "अनुरोध है कि यहाँ के पानी और नालियों की सफ़ाई कराई जाए और प्रदूषण के स्रोत की जाँच की जाए।",
  open_construction: "अनुरोध है कि मलबे को ढका या हटाया जाए और धूल नियंत्रण के उपाय लागू कराए जाएँ।",
  overflowing_bin: "कृपया कूड़ेदान को नियमित रूप से खाली कराएँ और उसकी मरम्मत कराएँ या उसे बदलवाएँ।",
};

const OFFICE: Readonly<Record<CcLine["office"], string>> = {
  councillor: "के पार्षद",
  mla: "के विधायक",
  mp: "के सांसद",
};

// Hindi prose for the template; phrases avoid case endings so each WHAT entry fits every slot.
export class HindiWording implements TemplateWording {
  readonly language = "hi";
  readonly #binRadiusM: number;

  constructor(binRadiusM = 3000) {
    this.#binRadiusM = binRadiusM;
  }

  subject(site: LetterSite): string {
    return `अनुरोध: ${site.place.name()} में ${WHAT[site.context]} (JunkSnap site ${site.siteId})`;
  }

  opening(to: Recipient): string {
    return `सेवा में,\n${to.office},\n${to.body}`;
  }

  facts(site: LetterSite): string {
    const { lat, lon, reportCount, verifiedCount, firstReportedAt, photoUrls } = site.evidence;
    const lines = [
      `निवासियों ने ${site.place.name()} में (${coordinates(lat, lon)}) यह सूचना दी है: ${WHAT[site.context]}।`,
      `${letterDate(firstReportedAt, "hi-IN")} से अब तक रिपोर्ट: ${reportCount} (${verifiedCount} सत्यापित)।`,
    ];
    if (site.burning) {
      lines.push("इस स्थान पर कचरा जलता हुआ देखा गया है।");
    }
    const photos = photoUrls.length > 0 ? `\nधुंधली की गई तस्वीरें: ${photoUrls.join(" ")}` : "";
    return `${lines.join(" ")}${photos}`;
  }

  rulesIntro(): string {
    return "संबंधित प्रावधान (आधिकारिक अंग्रेज़ी पाठ):";
  }

  request(site: LetterSite): string {
    if (site.reportType !== "no_bin") {
      return REQUEST[site.reportType];
    }
    return `${new NoBinStatement(this.#binRadiusM).hindi(site)} ${REQUEST.no_bin}`;
  }

  closing(cc: readonly CcLine[]): string {
    const filed = "यह पत्र एक निवासी द्वारा भेजा जा रहा है।";
    if (cc.length === 0) {
      return filed;
    }
    const copies = cc.map((line) => `${line.seat.name} ${OFFICE[line.office]}`);
    return `${filed} प्रतिलिपि सूचनार्थ: ${joinList(copies, "और")}।`;
  }
}
