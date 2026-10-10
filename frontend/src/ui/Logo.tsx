import './logo.css';

interface LogoProps {
  /** Mark only, e.g. for the loading animation. */
  readonly markOnly?: boolean;
  readonly size?: number;
}

/** The camera with a crumpled paper ball for a lens, and the two-tone wordmark. The visible name is the text. */
export function Logo({ markOnly = false, size = 36 }: LogoProps) {
  return (
    <span className="logo">
      <img className="logo__mark" src="/brand/junksnap-mark.svg" width={size} height={size} alt="" />
      {!markOnly && (
        <span className="logo__word" lang="en">
          Junk<span className="logo__snap">Snap</span>
        </span>
      )}
    </span>
  );
}
