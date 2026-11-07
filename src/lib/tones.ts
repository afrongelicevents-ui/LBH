/**
 * Status colours for the portals (no orange):
 *   ok (green)     = assigned / approved / chosen
 *   prog (blue)    = in progress / pending / waiting
 *   done (purple)  = done / draft / quoted / submitted
 *   grey           = locked / cancelled / not chosen
 */
export type Tone = "ok" | "prog" | "done" | "grey";

const MAP: Record<string, Tone> = {
  // jobs
  assigned: "ok",
  in_progress: "prog",
  submitted: "done",
  completed: "done",
  // requests
  new: "prog",
  call_booked: "prog",
  quote_sent: "done",
  accepted: "ok",
  deposit_paid: "ok",
  on_site: "prog",
  report_ready: "done",
  balance_paid: "ok",
  done: "done",
  cancelled: "grey",
  // build stages
  locked: "grey",
  quoting: "done",
  quote_approved: "prog",
  paid: "prog",
  purchased: "prog",
  delivered: "prog",
  building: "prog",
  inspected: "prog",
  approved: "ok",
  // quotes / payments / bookings / reports
  pending: "prog",
  rejected: "grey",
  confirmed: "ok",
  failed: "grey",
  draft: "done",
  changes_requested: "prog",
  published: "ok",
  forwarded: "prog",
};

export function toneFor(status: string | null | undefined): Tone {
  return (status && MAP[status]) || "grey";
}
