"use client";

import { useState } from "react";
import { SearchIcon } from "./PortalIcons";

export interface SearchItem {
  key: string;
  /** lowercase-insensitive text the search box matches */
  text: string;
  /** filter group (matches a filter's key) */
  group: string;
  node: React.ReactNode;
}

/** Search box + filter pills over server-rendered cards. */
export default function SearchableList({
  items,
  filters,
  searchLabel,
  emptyLabel,
}: {
  items: SearchItem[];
  filters: { key: string; label: string; groups?: string[] }[];
  searchLabel: string;
  emptyLabel: string;
}) {
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState(filters[0]?.key ?? "all");
  const active = filters.find((f) => f.key === filter);
  const inFilter = (i: SearchItem) => !active?.groups || active.groups.includes(i.group);
  const needle = q.trim().toLowerCase();
  const shown = items.filter((i) => inFilter(i) && (!needle || i.text.toLowerCase().includes(needle)));

  return (
    <div className="space-y-3">
      <label className="search-pill">
        <SearchIcon size={20} className="text-muted" />
        <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={searchLabel} aria-label={searchLabel} />
      </label>
      {filters.length > 1 && (
        <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" role="group">
          {filters.map((f) => (
            <button key={f.key} type="button" className="chip" aria-pressed={filter === f.key} onClick={() => setFilter(f.key)}>
              {f.label} ({items.filter((i) => !f.groups || f.groups.includes(i.group)).length})
            </button>
          ))}
        </div>
      )}
      {shown.length === 0 ? (
        <p className="card p-6 text-center text-sm text-muted">{emptyLabel}</p>
      ) : (
        <ul className="space-y-3">
          {shown.map((i) => (
            <li key={i.key}>{i.node}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
