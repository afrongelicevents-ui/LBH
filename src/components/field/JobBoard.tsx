"use client";

import { useMemo, useState } from "react";
import { Link } from "@/i18n/navigation";
import type { Tone } from "@/lib/tones";
import { StatusBadge, JobThumb } from "@/components/ui/Portal";
import {
  ArrowRightIcon,
  CalendarIcon,
  CameraIcon,
  ChevronRightIcon,
  DocIcon,
  HelmetIcon,
  HomeIcon,
  PenIcon,
  PinIcon,
  SearchIcon,
  UserIcon,
} from "@/components/ui/PortalIcons";

export interface BoardJob {
  id: string;
  title: string;
  location: string;
  clientFirstName: string;
  typeLabel: string;
  status: string; // assigned | in_progress | submitted | completed
  statusLabel: string;
  tone: Tone;
  dueLabel: string | null;
  overdue: boolean;
  photoUrl: string | null;
}

type Filter = "all" | "assigned" | "in_progress" | "done";
const isDone = (s: string) => s === "submitted" || s === "completed";

/**
 * Field / lawyer job list: search box, filter pills, job cards.
 * Filtering happens on the phone (no extra requests, works offline).
 */
export default function JobBoard({
  jobs,
  variant,
  labels,
}: {
  jobs: BoardJob[];
  variant: "field" | "lawyer";
  labels: {
    search: string;
    all: string;
    assigned: string;
    inProgress: string;
    completed: string;
    viewDetails: string;
    clientLabel: string;
    noMatch: string;
    noJobs: string;
    noPhoto: string;
    overdue: string;
    actionReview: string;
    actionContinue: string;
    actionView: string;
  };
}) {
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<Filter>("all");

  const counts = useMemo(
    () => ({
      all: jobs.length,
      assigned: jobs.filter((j) => j.status === "assigned").length,
      in_progress: jobs.filter((j) => j.status === "in_progress").length,
      done: jobs.filter((j) => isDone(j.status)).length,
    }),
    [jobs]
  );

  const shown = jobs.filter((j) => {
    if (filter === "assigned" && j.status !== "assigned") return false;
    if (filter === "in_progress" && j.status !== "in_progress") return false;
    if (filter === "done" && !isDone(j.status)) return false;
    const needle = q.trim().toLowerCase();
    if (!needle) return true;
    return [j.title, j.location, j.clientFirstName, j.typeLabel].join(" ").toLowerCase().includes(needle);
  });

  const pills: { key: Filter; label: string }[] = [
    { key: "all", label: `${labels.all} (${counts.all})` },
    { key: "assigned", label: `${labels.assigned} (${counts.assigned})` },
    { key: "in_progress", label: `${labels.inProgress} (${counts.in_progress})` },
    { key: "done", label: `${labels.completed} (${counts.done})` },
  ];

  return (
    <div className="space-y-3">
      <label className="search-pill">
        <SearchIcon size={20} className="text-muted" />
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={labels.search}
          aria-label={labels.search}
        />
      </label>

      {variant === "field" && (
        <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" role="group">
          {pills.map((p) => (
            <button
              key={p.key}
              type="button"
              className="chip"
              aria-pressed={filter === p.key}
              onClick={() => setFilter(p.key)}
            >
              {p.label}
            </button>
          ))}
        </div>
      )}

      {jobs.length === 0 ? (
        <p className="card p-6 text-center text-sm text-muted">{labels.noJobs}</p>
      ) : shown.length === 0 ? (
        <p className="card p-6 text-center text-sm text-muted">{labels.noMatch}</p>
      ) : variant === "field" ? (
        <ul className="space-y-3">
          {shown.map((j) => (
            <li key={j.id}>
              <article className="card relative flex gap-3 p-4" data-testid="job-card">
                <div className="min-w-0 flex-1">
                  <StatusBadge tone={j.tone}>{j.statusLabel}</StatusBadge>
                  <h3 className="mt-2 text-[15px] leading-snug font-extrabold text-ink sm:text-base">
                    <Link href={`/field/jobs/${j.id}`} className="after:absolute after:inset-0">
                      {j.title}
                    </Link>
                  </h3>
                  <p className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-ink">
                    {j.location && (
                      <span className="flex items-center gap-1">
                        <PinIcon size={16} className="text-muted" />
                        {j.location}
                      </span>
                    )}
                    {j.clientFirstName && (
                      <span className="flex items-center gap-1">
                        <UserIcon size={16} className="text-muted" />
                        {labels.clientLabel}: <strong className="font-semibold">{j.clientFirstName}</strong>
                      </span>
                    )}
                  </p>
                  <p className="mt-1 flex items-center gap-1 text-[13px] text-muted">
                    <HelmetIcon size={16} />
                    {j.typeLabel}
                  </p>
                  {j.dueLabel && (
                    <p className={`mt-1 flex items-center gap-1 text-[13px] font-semibold ${j.overdue ? "text-red-700" : "text-ink"}`}>
                      <CalendarIcon size={16} className={j.overdue ? "" : "text-muted"} />
                      {j.dueLabel}
                      {j.overdue && ` · ${labels.overdue}`}
                    </p>
                  )}
                  <span className="btn-details relative z-10 mt-3 pointer-events-none">
                    {labels.viewDetails}
                    <ArrowRightIcon size={16} />
                  </span>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-2">
                  <ChevronRightIcon size={20} className="text-ink" />
                  <JobThumb
                    url={j.photoUrl}
                    label={j.photoUrl ? j.title : labels.noPhoto}
                    icon={
                      <>
                        <CameraIcon size={26} />
                        <span className="px-1 text-center text-[10px] leading-tight font-semibold">{labels.noPhoto}</span>
                      </>
                    }
                    className="h-24 w-28 sm:h-28 sm:w-36"
                  />
                </div>
              </article>
            </li>
          ))}
        </ul>
      ) : (
        <ul className="space-y-3">
          {shown.map((j) => {
            const done = isDone(j.status);
            const Icon = j.status === "assigned" ? HomeIcon : j.status === "in_progress" ? DocIcon : PenIcon;
            const tone = j.status === "assigned" ? "ok" : j.status === "in_progress" ? "prog" : "done";
            return (
              <li key={j.id}>
                <article className="card relative flex items-center gap-3 p-4" data-testid="job-card">
                  <span className={`icon-round icon-${tone} h-14 w-14 sm:h-16 sm:w-16`}>
                    <Icon size={28} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <h3 className="text-[15px] leading-snug font-extrabold text-ink">
                      <Link href={`/field/jobs/${j.id}`} className="after:absolute after:inset-0">
                        {j.title}
                      </Link>
                    </h3>
                    {j.location && (
                      <p className="mt-1 flex items-center gap-1 text-[13px] text-ink">
                        <PinIcon size={16} className="text-muted" />
                        {j.location}
                      </p>
                    )}
                    <p className={`mt-0.5 flex items-center gap-1 text-[13px] font-semibold ${j.overdue ? "text-red-700" : "text-ink"}`}>
                      <CalendarIcon size={16} className={j.overdue ? "" : "text-muted"} />
                      {j.dueLabel ?? j.typeLabel}
                      {j.overdue && ` · ${labels.overdue}`}
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-2 sm:hidden">
                      <StatusBadge tone={j.tone}>{j.statusLabel}</StatusBadge>
                      <span className="btn-details pointer-events-none min-h-9 px-3 py-1.5 text-xs">
                        {j.status === "assigned" ? labels.actionReview : done ? labels.actionView : labels.actionContinue}
                        <ArrowRightIcon size={14} />
                      </span>
                    </div>
                  </div>
                  <div className="hidden shrink-0 flex-col items-end gap-2 sm:flex">
                    <StatusBadge tone={j.tone}>{j.statusLabel}</StatusBadge>
                    <span className="btn-details pointer-events-none">
                      {j.status === "assigned" ? labels.actionReview : done ? labels.actionView : labels.actionContinue}
                      <ArrowRightIcon size={16} />
                    </span>
                  </div>
                  <ChevronRightIcon size={20} className="shrink-0 text-ink" />
                </article>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
