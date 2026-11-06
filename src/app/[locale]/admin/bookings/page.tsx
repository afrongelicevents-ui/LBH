import { getTranslations, setRequestLocale } from "next-intl/server";
import { requireRole } from "@/lib/auth/guard";
import { BookingStatusButtons } from "@/components/admin/AdminActions";

export default async function AdminBookingsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { supabase } = await requireRole(locale, ["admin"]);
  const t = await getTranslations("admin.bookings");

  const { data: bookings } = await supabase
    .from("call_bookings")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(200);

  return (
    <div className="space-y-4">
      <h1 className="headline text-2xl text-forest">{t("title")}</h1>
      <ul className="space-y-3">
        {(bookings ?? []).map((b) => (
          <li key={b.id} className="card p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="font-bold text-forest">
                  {b.name} <span className="font-normal text-muted">· {b.email}</span>
                </p>
                <p className="text-xs text-muted">
                  {b.whatsapp} · {b.country} · {b.service} · {b.preferred_slot} ·{" "}
                  {b.call_type} · {new Date(b.created_at).toLocaleString()}
                </p>
                {b.description && <p className="mt-1 text-sm text-ink">{b.description}</p>}
              </div>
              <div className="flex flex-col items-end gap-2">
                <span className="rounded-full bg-offwhite px-2.5 py-1 text-[11px] font-bold text-forest">
                  {b.status}
                </span>
                {["new", "confirmed"].includes(b.status) && (
                  <BookingStatusButtons bookingId={b.id} />
                )}
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
