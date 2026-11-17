import { getTranslations } from "next-intl/server";
import { formatCents } from "@/lib/money";
import { signedUrl } from "@/lib/uploads";
import { ROOMS } from "@/lib/interiors";
import type { createClient } from "@/lib/supabase/server";
import InteriorChoice from "./InteriorChoice";

type Db = Awaited<ReturnType<typeof createClient>>;
export type InteriorItem = {
  id: string; room: string; name: string; shop: string; qty: number; price_cents: number;
  link: string; note: string; status: "option" | "chosen" | "declined" | "bought" | "delivered"; receipt_media_id: string | null;
};

/** Room label: one of our room keys, or what LBH typed. */
export async function roomLabel() {
  const t = await getTranslations("site.interiors.form.room");
  return (r: string) => ((ROOMS as readonly string[]).includes(r) ? t(r as never) : r);
}

/** The interiors request details (from the booking form). */
export async function InteriorsDetails({ details }: { details: Record<string, unknown> }) {
  const t = await getTranslations("account.interiors");
  const tf = await getTranslations("site.interiors.form");
  const label = await roomLabel();
  const rooms = Array.isArray(details.rooms) ? (details.rooms as string[]) : [];
  const row = (k: string, v: string) => (
    <div key={k}>
      <dt className="font-semibold text-muted">{k}</dt>
      <dd className="text-ink">{v || "—"}</dd>
    </div>
  );
  const s = (k: string) => (typeof details[k] === "string" ? (details[k] as string) : "");
  return (
    <dl className="mt-3 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2" data-testid="interiors-details">
      {row(tf("location"), s("location"))}
      {row(tf("houseStatus"), s("house_status") ? tf(`status.${s("house_status")}` as never) : "")}
      {row(tf("rooms"), rooms.map(label).join(", "))}
      {row(tf("budget"), s("budget") ? tf(`budgets.${s("budget")}` as never) : "")}
      {row(tf("timeline"), s("timeline") ? tf(`timelines.${s("timeline")}` as never) : "")}
      {row(t("call"), [s("slot") && tf(`slots.${s("slot")}` as never), s("call_type") && tf(`callTypes.${s("call_type")}` as never)].filter(Boolean).join(" · "))}
      {s("styles") && <div className="sm:col-span-2">{row(tf("styles"), s("styles"))}</div>}
    </dl>
  );
}

/** Items per room (choose / decline), the chosen list with total, and photos per room. */
export default async function InteriorsProject({ supabase, requestId }: { supabase: Db; requestId: string }) {
  const t = await getTranslations("account.interiors");
  const label = await roomLabel();
  const [{ data: itemRows }, { data: photoRows }] = await Promise.all([
    supabase.from("interior_items").select("id, room, name, shop, qty, price_cents, link, note, status, receipt_media_id").eq("request_id", requestId).order("room").order("created_at"),
    supabase.from("interior_photos").select("id, room, storage_path, caption, taken_on, created_at").eq("request_id", requestId).order("room").order("created_at"),
  ]);
  const items = (itemRows ?? []) as InteriorItem[];
  const byRoom = new Map<string, InteriorItem[]>();
  for (const it of items) byRoom.set(it.room, [...(byRoom.get(it.room) ?? []), it]);
  const picked = items.filter((i) => ["chosen", "bought", "delivered"].includes(i.status));
  const total = picked.reduce((s, i) => s + i.qty * i.price_cents, 0);
  const receiptIds = picked.map((i) => i.receipt_media_id).filter((x): x is string => Boolean(x));
  const { data: receiptRows } = receiptIds.length ? await supabase.from("media").select("id, storage_path").in("id", receiptIds) : { data: [] };
  const receipts = new Map(
    await Promise.all(
      picked
        .filter((i) => i.receipt_media_id)
        .map(async (i) => {
          const m = (receiptRows ?? []).find((r) => r.id === i.receipt_media_id);
          return [i.id, m ? await signedUrl("media", m.storage_path, 900) : null] as const;
        })
    )
  );
  const photos = await Promise.all((photoRows ?? []).map(async (p) => ({ ...p, url: await signedUrl("media", p.storage_path, 900) })));
  const photosByRoom = new Map<string, typeof photos>();
  for (const p of photos) photosByRoom.set(p.room, [...(photosByRoom.get(p.room) ?? []), p]);

  const badge = (s: InteriorItem["status"]) => (
    <span className={`badge badge-dot ${s === "chosen" || s === "delivered" ? "badge-ok" : s === "bought" ? "badge-prog" : s === "declined" ? "badge-grey" : "badge-done"}`}>{t(`status.${s}`)}</span>
  );

  return (
    <>
      {items.length === 0 && photos.length === 0 && (
        <section className="card p-5" data-testid="interiors-next">
          <h2 className="text-base font-bold text-forest">{t("nextTitle")}</h2>
          <p className="mt-1 text-sm text-muted">{t("nextText")}</p>
        </section>
      )}

      {items.length > 0 && (
        <section className="card p-5" id="items" data-testid="interiors-items">
          <h2 className="text-base font-bold text-forest">{t("itemsTitle")}</h2>
          <p className="mt-1 text-xs text-muted">{t("itemsHint")}</p>
          {[...byRoom.entries()].map(([room, list]) => (
            <div key={room} className="mt-5">
              <h3 className="font-serif text-lg text-charcoal">{label(room)}</h3>
              <ul className="mt-2 space-y-3">
                {list.map((it) => (
                  <li key={it.id} className={`rounded-xl border p-4 ${it.status === "chosen" ? "border-ok-line bg-ok-soft/40" : "border-line"}`} data-testid="interior-item">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-bold text-ink">{it.name}</p>
                        <p className="text-xs text-muted">
                          {[it.shop, it.qty > 1 ? t("qtyEach", { qty: it.qty, price: formatCents(it.price_cents) }) : null].filter(Boolean).join(" · ")}
                        </p>
                        {it.note && <p className="mt-1 text-xs text-muted">{it.note}</p>}
                        {it.link && (
                          <a href={it.link} target="_blank" rel="noopener noreferrer nofollow" className="mt-1 inline-block text-xs font-bold text-forest underline underline-offset-2">
                            {t("viewItem")}
                          </a>
                        )}
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-bold text-ink">{formatCents(it.qty * it.price_cents)}</span>
                        {badge(it.status)}
                      </div>
                    </div>
                    {["option", "chosen", "declined"].includes(it.status) && (
                      <div className="mt-3">
                        <InteriorChoice id={it.id} status={it.status as "option" | "chosen" | "declined"} />
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </section>
      )}

      {picked.length > 0 && (
        <section className="card p-5" id="chosen" data-testid="interiors-chosen">
          <h2 className="text-base font-bold text-forest">{t("chosenTitle")}</h2>
          <table className="mt-3 w-full text-sm">
            <tbody>
              {picked.map((i) => (
                <tr key={i.id} className="border-b border-line">
                  <td className="py-2 pr-2 text-ink">
                    {i.name}
                    <span className="block text-xs text-muted">
                      {label(i.room)}
                      {i.qty > 1 ? ` · ×${i.qty}` : ""} · {t(`status.${i.status}`)}
                      {receipts.get(i.id) && (
                        <>
                          {" · "}
                          <a href={receipts.get(i.id)!} target="_blank" rel="noopener noreferrer" className="font-bold text-forest underline underline-offset-2">
                            {t("receipt")}
                          </a>
                        </>
                      )}
                    </span>
                  </td>
                  <td className="py-2 text-right font-semibold whitespace-nowrap text-ink">{formatCents(i.qty * i.price_cents)}</td>
                </tr>
              ))}
              <tr>
                <td className="py-2 pr-2 font-bold text-forest">{t("total")}</td>
                <td className="py-2 text-right font-bold whitespace-nowrap text-forest" data-testid="interiors-total">{formatCents(total)}</td>
              </tr>
            </tbody>
          </table>
          <p className="mt-2 text-xs text-muted">{t("chosenNote")}</p>
        </section>
      )}

      {photos.length > 0 && (
        <section className="card p-5" id="room-photos" data-testid="interiors-photos">
          <h2 className="text-base font-bold text-forest">{t("photosTitle")}</h2>
          {[...photosByRoom.entries()].map(([room, list]) => (
            <div key={room} className="mt-4">
              <h3 className="font-serif text-lg text-charcoal">{label(room)}</h3>
              <ul className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-3">
                {list.map((p) =>
                  p.url ? (
                    <li key={p.id}>
                      <a href={p.url} target="_blank" rel="noopener noreferrer" className="block overflow-hidden rounded-lg border border-line">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={p.url} alt={p.caption || label(room)} className="aspect-[4/3] w-full object-cover" loading="lazy" />
                      </a>
                      <p className="mt-1 text-xs text-muted">
                        {p.caption}
                        {p.caption ? " · " : ""}
                        {new Date(p.taken_on ?? p.created_at).toLocaleDateString()}
                      </p>
                    </li>
                  ) : null
                )}
              </ul>
            </div>
          ))}
        </section>
      )}
    </>
  );
}
