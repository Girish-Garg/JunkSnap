import type { AreaLetterSite } from '../../../domain/AreaLetter';
import type { AreaEvidenceLines } from '../AreaEvidenceLines';
import type { LetterText } from '../LetterText';
import { EvidencePhotos } from './EvidencePhotos';

interface WorstSiteProps {
  readonly site: AreaLetterSite;
  readonly lines: AreaEvidenceLines;
  readonly text: LetterText;
}

/** One of the area's worst verified sites: type, place, status, counts, dates, measured insights and blurred photos. */
export function WorstSite({ site, lines, text }: WorstSiteProps) {
  const insights = lines.siteInsights(site);
  return (
    <div className="letter__citation">
      <p className="letter__source">{lines.site(site)}</p>
      <p className="letter__hash">{lines.siteDates(site)}</p>
      {insights.length > 0 && (
        <ul className="letter__insights">
          {insights.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      )}
      <EvidencePhotos urls={site.photo_urls} text={text} />
    </div>
  );
}
