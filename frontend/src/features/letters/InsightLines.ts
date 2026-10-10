import type { LetterEvidence } from '../../domain/SiteActions';
import type { LocaleFormatter } from '../../i18n/LocaleFormatter';
import type { LetterText } from './LetterText';

/** A site's measured insights as letter lines: composition, size, hazards and nearby places, each with its basis. */
export class InsightLines {
  static of(insights: LetterEvidence['insights'], text: LetterText, format: LocaleFormatter): readonly string[] {
    if (!insights) return [];
    const composition = insights.composition.map((part) =>
      text.label('evidence.material', { material: text.term(`areas.material.${part.material}`), pct: Math.round(part.share_pct), count: part.reports }),
    );
    const size = insights.size_class ? [text.label(`evidence.size.${insights.size_class}`)] : [];
    const hazards = insights.hazards.map((hazard) => text.label('evidence.hazard', { hazard: text.term(`letter.evidence.hazards.${hazard}`) }));
    const near = insights.near.map((place) => text.label(`evidence.near.${place.kind}`, { distance: format.distance(place.distance_m) }));
    return [...composition, ...size, ...hazards, ...near];
  }
}
