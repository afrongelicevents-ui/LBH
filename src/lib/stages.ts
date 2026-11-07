/** Construction build stages (brief: stage-by-stage materials + inspection). */

export const STAGE_ORDER = [
  "locked",
  "quoting",
  "quote_approved",
  "paid",
  "purchased",
  "delivered",
  "building",
  "inspected",
  "approved",
] as const;

export type StageStatus = (typeof STAGE_ORDER)[number];

export const DEFAULT_STAGES: { name: string; description: string }[] = [
  { name: "Foundation", description: "Excavation, concrete footings and foundation walls up to slab level." },
  { name: "Slab", description: "Hardcore fill, damp-proof membrane, mesh and concrete floor slab." },
  { name: "Window level", description: "Brickwork from slab up to window-sill level." },
  { name: "Wall plate", description: "Brickwork up to wall-plate level, lintels and ring beam." },
  { name: "Roof", description: "Roof trusses, purlins and roof sheets or tiles." },
  { name: "Finishes", description: "Plaster, floors, windows, doors, plumbing, electrics and paint." },
];

/** Steps shown on each stage card, in order (locked/approved are states, not steps). */
export const STAGE_STEPS: StageStatus[] = [
  "quoting",
  "quote_approved",
  "paid",
  "purchased",
  "delivered",
  "building",
  "inspected",
];

export function stepIndex(status: StageStatus): number {
  return STAGE_ORDER.indexOf(status);
}
