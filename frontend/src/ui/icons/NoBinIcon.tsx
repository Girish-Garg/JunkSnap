import { CartoonSvg, type CartoonIconProps } from './CartoonSvg';

/** A bin that is not there: crossed out. */
export function NoBinIcon(props: CartoonIconProps) {
  return (
    <CartoonSvg {...props}>
      <path className="tone" d="M7 8.5h10l-1.2 11.5h-7.6z" />
      <path d="M5.5 8.5h13M10 8.5v-2h4v2M3.5 3.5l17 17" />
    </CartoonSvg>
  );
}
