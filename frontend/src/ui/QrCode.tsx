import { encode } from 'uqr';

interface QrCodeProps {
  readonly text: string;
  readonly label: string;
  readonly size?: number;
}

/** Dark modules on white whatever the theme, so every phone camera reads it. Loaded lazily (desktop only). */
export default function QrCode({ text, label, size = 184 }: QrCodeProps) {
  const { data, size: modules } = encode(text, { border: 2, ecc: 'M' });
  const path = data
    .flatMap((row, y) => row.map((dark, x) => (dark ? `M${x} ${y}h1v1h-1z` : '')))
    .join('');
  return (
    <svg className="qr" width={size} height={size} viewBox={`0 0 ${modules} ${modules}`} role="img" aria-label={label} shapeRendering="crispEdges">
      <rect width={modules} height={modules} fill="#ffffff" />
      <path d={path} fill="#221c15" />
    </svg>
  );
}
