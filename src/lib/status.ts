/** Client-facing request journey (brief §5.2). */
export const REQUEST_TIMELINE = [
  "call_booked",
  "quote_sent",
  "accepted",
  "deposit_paid",
  "on_site",
  "report_ready",
  "balance_paid",
  "done",
] as const;

export type RequestStatus =
  | "new"
  | (typeof REQUEST_TIMELINE)[number]
  | "cancelled";

/** Index of a status on the timeline; "new" sits before step 0. */
export function timelineIndex(status: RequestStatus): number {
  const i = REQUEST_TIMELINE.indexOf(status as (typeof REQUEST_TIMELINE)[number]);
  return i;
}
