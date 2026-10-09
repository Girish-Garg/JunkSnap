export function joinList(items: readonly string[], and: string): string {
  const last = items.at(-1);
  if (items.length < 2 || last === undefined) {
    return items.join("");
  }
  return `${items.slice(0, -1).join(", ")} ${and} ${last}`;
}

export function letterDate(iso: string, locale: string): string {
  const format = { day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Kolkata" } as const;
  return new Intl.DateTimeFormat(locale, format).format(new Date(iso));
}

export function coordinates(lat: number, lon: number): string {
  return `${lat.toFixed(4)} N, ${lon.toFixed(4)} E`;
}
