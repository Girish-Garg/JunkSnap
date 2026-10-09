interface SkeletonProps {
  readonly width?: string;
  readonly height: string;
}

export function Skeleton({ width = '100%', height }: SkeletonProps) {
  return <span className="skeleton" style={{ width, height }} aria-hidden="true" />;
}
