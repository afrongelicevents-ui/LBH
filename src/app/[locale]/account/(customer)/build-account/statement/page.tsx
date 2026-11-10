import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { formatCents } from "@/lib/money";
import { signedUrl } from "@/lib/uploads";
import { createAdminClient } from "@/lib/supabase/admin";
import { waLink } from "@/config/site";
import { loadBaPage } from "@/lib/buildAccount/page";
import * as M from "@/lib/buildAccount/math";
import { accountName, currentMonth, receiverOf } from "@/lib/buildAccount/view";
import BaShell from "@/components/buildAccount/BaShell";
import AttachReceipt from "@/components/buildAccount/AttachReceipt";
import { ConfirmTransferButtons, DeleteEntryButton } from "@/components/buildAccount/BaButtons";
import { StatusBadge } from "@/components/ui/Portal";
import { DocIcon } from "@/components/ui/PortalIcons";

type Filter = "all" | "in" | "out" | "noreceipt";

/** Build Account — Statement: bank-style list with running balance. */
export default async function StatementPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ owner?: string; acct?: string; f?: string }>;
}) {
  const { locale } = await params;
  const sp = await searchParams;
  setRequestLocale(locale);
  const page = await loadBaPage(locale, sp.owner);
  const t = await getTranslations("ba");
  const { data, ctx } = page;

  const selected = sp.acct && data.accounts.some((a) => a.id === sp.acct) ? sp.acct : "all";
  const filter: Filter = (["all", "in", "out", "noreceipt"] as const).includes(sp.f as Filter) ? (sp.f as Filter) : "all";
  // running balance is worked out on the whole account, then filtered
  const rows = M.statement(M.inAccount(data.entries, selected)).filter((e) =>
    filter === "in" ? e.direction === "in" : filter === "out" ? e.direction === "out" : filter === "noreceipt" ? e.direction === "out" && !M.hasReceipt(e) : true
  );

  // receipt links (private storage → short-lived links after the access check above)
  const admin = createAdminClient();
  const mediaIds = data.entries.filter((e) => e.receipt_source === "lbh").map((e) => e.id);
  const { data: lbhMedia } = mediaIds.length
    ? await admin.from("ba_entries").select("id, lbh_media_id").in("id", mediaIds).not("lbh_media_id", "is", null)
    : { data: [] };
  const mediaPaths = lbhMedia?.length
    ? (await admin.from("media").select("id, storage_path").in("id", lbhMedia.map((m) => m.lbh_media_id))).data ?? []
    : [];
  const receiptUrl = new Map<string, string | null>();
  await Promise.all(
    rows.slice(0, 200).map(async (e) => {
      if (e.receipt_path) receiptUrl.set(e.id, await signedUrl("documents", e.receipt_path, 600));
      else if (e.receipt_source === "lbh") {
        const mid = lbhMedia?.find((m) => m.id === e.id)?.lbh_media_id;
        const p = mediaPaths.find((m) => m.id === mid)?.storage_path;
        receiptUrl.set(e.id, p ? await signedUrl("media", p, 600) : null);
      }
    })
  );

  const memberWhatsapp = (accountId: string) => {
    const acc = data.accounts.find((a) => a.id === accountId);
    return data.members.find((m) => m.id === acc?.holder_member_id)?.whatsapp ?? null;
  };
  const askLink = (e: M.BaEntry) => {
    const text = t("askText", { what: (e.description || e.shop).replace(/^SAMPLE\s+/, ""), amount: formatCents(e.amount_cents), date: e.occurred_on });
    const phone = (memberWhatsapp(e.account_id) ?? "").replace(/[^0-9]/g, "");
    return phone ? `https://wa.me/${phone}?text=${encodeURIComponent(text)}` : waLink(text);
  };
  const qs = (patch: Record<string, string>) => {
    const p = new URLSearchParams();
    if (!ctx.isOwner) p.set("owner", ctx.ownerId);
    if (selected !== "all") p.set("acct", selected);
    if (filter !== "all") p.set("f", filter);
    for (const [k, v] of Object.entries(patch)) {
      if (v === "all") p.delete(k);
      else p.set(k, v);
    }
    const s = p.toString();
    return s ? `?${s}` : "";
  };
  const fmtDate = (d: string) => new Date(`${d}T12:00:00`).toLocaleDateString(locale === "en" ? "en-GB" : locale, { day: "numeric", month: "short", year: "numeric" });
  const month = currentMonth();
  const pdfQs = new URLSearchParams({ month, ...(ctx.isOwner ? {} : { owner: ctx.ownerId }), ...(selected !== "all" ? { acct: selected } : {}) });

  return (
    <BaShell page={page} active="statement">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="-mx-1 flex gap-2 overflow-x-auto px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" role="group">
          {(["all", "in", "out", "noreceipt"] as const).map((f) => (
            <Link key={f} href={`/account/build-account/statement${qs({ f })}`} className="chip" aria-pressed={filter === f}>
              {t(`filter.${f}`)}
            </Link>
          ))}
        </div>
        <a href={`/api/pdf/build-account?${pdfQs}`} className="inline-flex items-center gap-1 text-sm font-bold text-forest underline underline-offset-2" data-testid="ba-pdf">
          <DocIcon size={16} />
          {t("monthlyPdf")}
        </a>
      </div>
      <div className="-mx-1 flex gap-2 overflow-x-auto px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {[{ id: "all", name: t("allAccounts") }, ...data.accounts.map((a) => ({ id: a.id, name: accountName(data, a.id) }))].map((a) => (
          <Link key={a.id} href={`/account/build-account/statement${qs({ acct: a.id })}`} className="chip" aria-pressed={selected === a.id}>
            {a.name}
          </Link>
        ))}
      </div>

      <section className="card overflow-hidden" data-testid="ba-statement">
        <div className="grid grid-cols-[1fr_auto_auto] gap-3 border-b border-[#eef0ef] px-4 py-2 text-[11px] font-bold tracking-wide text-muted uppercase sm:grid-cols-[6rem_1fr_6rem_6rem_6rem]">
          <span className="hidden sm:block">{t("col.date")}</span>
          <span>{t("col.description")}</span>
          <span className="hidden text-right sm:block">{t("col.in")}</span>
          <span className="text-right">{t("col.out")}</span>
          <span className="text-right">{t("col.balance")}</span>
        </div>
        {rows.length === 0 ? (
          <p className="p-6 text-center text-sm text-muted">{t("nothingHere")}</p>
        ) : (
          <ul className="divide-y divide-[#eef0ef]">
            {rows.map((e) => {
              const url = receiptUrl.get(e.id);
              const who = e.status === "pending" ? receiverOf(data.accounts.find((a) => a.id === e.account_id), ctx) : null;
              return (
                <li key={e.id} className="grid grid-cols-[1fr_auto_auto] items-start gap-3 px-4 py-3 text-sm sm:grid-cols-[6rem_1fr_6rem_6rem_6rem]" data-testid="ba-row">
                  <span className="hidden text-xs text-muted sm:block">{fmtDate(e.occurred_on)}</span>
                  <span className="min-w-0">
                    <span className="block font-semibold text-ink">{(e.description || e.shop).replace(/^SAMPLE\s+/, "")}</span>
                    <span className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-muted">
                      <span className="sm:hidden">{fmtDate(e.occurred_on)} ·</span>
                      {accountName(data, e.account_id)}
                      {e.stage_name && ` · ${e.stage_name}`}
                      {e.direction === "in" && e.service && ` · ${t(`service.${e.service}` as never)}`}
                      {e.fee_cents > 0 && ` · ${t("feeX", { fee: formatCents(e.fee_cents) })}`}
                    </span>
                    <span className="mt-1 flex flex-wrap items-center gap-2">
                      {e.status === "pending" && <StatusBadge tone="prog">{t("onItsWay")}</StatusBadge>}
                      {e.status === "rejected" && <StatusBadge tone="grey">{t("notReceivedBadge")}</StatusBadge>}
                      {e.source.startsWith("lbh_") && <StatusBadge tone="ok" dot={false}>{t("fromLbh")}</StatusBadge>}
                      {e.direction === "out" &&
                        (M.hasReceipt(e) ? (
                          url ? (
                            <a href={url} target="_blank" rel="noopener noreferrer" className="badge badge-done">
                              {t("receipt")} ✓
                            </a>
                          ) : (
                            <StatusBadge tone="done" dot={false}>{t("receipt")} ✓</StatusBadge>
                          )
                        ) : (
                          <>
                            <StatusBadge tone="grey" dot={false}>{t("noReceipt")}</StatusBadge>
                            <a href={askLink(e)} target="_blank" rel="noopener noreferrer" className="text-xs font-bold text-forest underline underline-offset-2" data-testid="ask-receipt">
                              {t("askForReceipt")}
                            </a>
                            {page.canAddTo(e.account_id) && e.source !== "lbh_purchase" && <AttachReceipt ownerId={ctx.ownerId} entryId={e.id} />}
                          </>
                        ))}
                      {who === "me" && <ConfirmTransferButtons ownerId={ctx.ownerId} entryId={e.id} />}
                      {who && who !== "me" && <span className="text-xs text-muted">{t(`waitFor.${who}`)}</span>}
                      {ctx.isOwner && page.writable && ["manual", "scan"].includes(e.source) && (
                        <DeleteEntryButton ownerId={ctx.ownerId} entryId={e.id} />
                      )}
                    </span>
                  </span>
                  <span className="hidden text-right font-bold text-ok sm:block">{e.direction === "in" ? `+${formatCents(e.amount_cents)}` : ""}</span>
                  <span className={`text-right font-bold ${e.direction === "in" ? "text-ok sm:text-ink" : "text-ink"} ${e.status !== "confirmed" ? "opacity-50" : ""}`}>
                    <span className={e.direction === "in" ? "sm:hidden" : ""}>
                      {e.direction === "in" ? "+" : "−"}
                      {formatCents(e.amount_cents)}
                    </span>
                  </span>
                  <span className="text-right text-xs font-semibold text-muted">{formatCents(e.running_cents)}</span>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </BaShell>
  );
}
