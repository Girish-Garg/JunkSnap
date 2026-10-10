import { CartoonSvg, type CartoonIconProps } from './CartoonSvg';

/** The logo's camera: chunky body, a paper ball in the lens, a flash pop. */
export function ReportIcon(props: CartoonIconProps) {
  return (
    <CartoonSvg {...props}>
      <path className="duo" d="M3 9a3 3 0 0 1 3-3h1.5l1.5-2h5l1.5 2h1.5a3 3 0 0 1 3 3v8a3 3 0 0 1-3 3h-11a3 3 0 0 1-3-3z" />
      <circle className="duo2" cx="11.5" cy="13" r="4" />
      <path d="M10 12.5l1.5-1l1.5 1.5M20 3l1-1.5M21.5 5.5l1.5-.5" />
    </CartoonSvg>
  );
}
