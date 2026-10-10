import type { LetterText } from '../LetterText';

interface EvidencePhotosProps {
  /** Blurred public copies only. */
  readonly urls: readonly string[];
  readonly text: LetterText;
}

export function EvidencePhotos({ urls, text }: EvidencePhotosProps) {
  if (urls.length === 0) return null;
  return (
    <ul className="letter__photos">
      {urls.map((url, index) => (
        <li key={url}>
          <img src={url} alt={text.label('evidence.photoAlt', { n: index + 1 })} loading="lazy" />
        </li>
      ))}
    </ul>
  );
}
