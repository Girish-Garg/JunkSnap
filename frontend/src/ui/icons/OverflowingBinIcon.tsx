import { CartoonSvg, type CartoonIconProps } from './CartoonSvg';

/** A bin with its lid flipped open, rubbish poking over the rim and a ball of it spilled on the ground. */
export function OverflowingBinIcon(props: CartoonIconProps) {
  return (
    <CartoonSvg {...props}>
      <circle className="paper" cx="8.5" cy="8" r="2.3" />
      <path className="tone" d="M5 10h10l-1.2 9.5h-7.6z" />
      <path className="hi" d="M8.5 13v3.5M11.5 13v3.5" />
      <circle className="paper" cx="18.6" cy="17.3" r="2.2" />
      <path d="M4 10h12M16 9.8l3.4-6.1M17.7 6.8l1.2.7M2 19.5h20" />
    </CartoonSvg>
  );
}
