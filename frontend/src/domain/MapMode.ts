// Auto: heatmap when zoomed out, pins from zoom 13. The other two force one view.
export const MAP_MODES = ['auto', 'pins', 'heat'] as const;

export type MapMode = (typeof MAP_MODES)[number];
