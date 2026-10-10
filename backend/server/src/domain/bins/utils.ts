// "Jodhpur" and the city file jodhpur.json share the slug jodhpur.
export function townSlug(town: string): string {
  return town.trim().toLowerCase().replace(/\s+/g, "-");
}
