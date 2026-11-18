/**
 * Office hours: "Online now" while the office is open, otherwise
 * "We'll reply within N hours". Pure functions (no server imports) so the
 * same rules run on the server, in tests and in the admin preview.
 */
export const DAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;
export type Day = (typeof DAYS)[number];
export type DayHours = { open: string; close: string } | null;
export type OfficeHours = Partial<Record<Day, DayHours>>;

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
export const isTime = (v: unknown): v is string => typeof v === "string" && TIME.test(v);

/** Keep only well-formed days (open before close); anything else = closed. */
export function cleanOfficeHours(raw: unknown): OfficeHours {
  const out: OfficeHours = {};
  const src = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  for (const d of DAYS) {
    const v = src[d] as { open?: unknown; close?: unknown } | null | undefined;
    out[d] = v && isTime(v.open) && isTime(v.close) && v.open < v.close ? { open: v.open, close: v.close } : null;
  }
  return out;
}

/** Day of week and "HH:MM" for `now` in the office time zone. */
export function localDayTime(now: Date, timeZone: string): { day: Day; time: string } {
  let parts: Intl.DateTimeFormatPart[];
  try {
    parts = new Intl.DateTimeFormat("en-GB", { timeZone, weekday: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(now);
  } catch {
    parts = new Intl.DateTimeFormat("en-GB", { timeZone: "Africa/Harare", weekday: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(now);
  }
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  const day = get("weekday").toLowerCase().slice(0, 3) as Day;
  return { day, time: `${get("hour").padStart(2, "0")}:${get("minute")}` };
}

export function isOpenNow(hours: OfficeHours, timeZone: string, now = new Date()): boolean {
  const { day, time } = localDayTime(now, timeZone);
  const h = hours[day];
  return Boolean(h && time >= h.open && time < h.close);
}

/** Hours (rounded down) a booking or chat has been waiting. */
export function hoursWaiting(since: string | Date, now = new Date()): number {
  return Math.max(0, Math.floor((now.getTime() - new Date(since).getTime()) / 3_600_000));
}

/** "35 min", "5 h", "2 d 3 h" */
export function waitingLabel(since: string | Date, now = new Date()): string {
  const mins = Math.max(0, Math.floor((now.getTime() - new Date(since).getTime()) / 60_000));
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  if (h < 24) return `${h} h`;
  return `${Math.floor(h / 24)} d ${h % 24} h`;
}
