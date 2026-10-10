export function at(values: ArrayLike<number>, index: number): number {
  return values[index] ?? 0;
}

export function median(values: readonly number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? at(sorted, middle) : (at(sorted, middle - 1) + at(sorted, middle)) / 2;
}

export function radians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

export function unique(values: readonly string[]): string[] {
  return [...new Set(values)];
}

// Short plain duration for check details, for example "47 s", "12 min" or "80 h".
export function formatDuration(seconds: number): string {
  const whole = Math.round(Math.abs(seconds));
  if (whole < 120) {
    return `${whole} s`;
  }
  return whole < 7200 ? `${Math.round(whole / 60)} min` : `${Math.round(whole / 3600)} h`;
}
