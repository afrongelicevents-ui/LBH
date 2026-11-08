import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { loadBaPage } from "@/lib/buildAccount/page";
import { accountName, todayIso } from "@/lib/buildAccount/view";
import BaShell from "@/components/buildAccount/BaShell";
import * as M from "@/lib/buildAccount/math";
import ScanReceipt from "@/components/buildAccount/ScanReceipt";

export default async function ScanPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ owner?: string }>;
}) {
  const { locale } = await params;
  const { owner } = await searchParams;
  setRequestLocale(locale);
  const page = await loadBaPage(locale, owner);
  const t = await getTranslations("ba");
  const accounts = page.data.accounts.filter((a) => page.canAddTo(a.id)).map((a) => ({ id: a.id, name: accountName(page.data, a.id), balance_cents: M.balance(M.inAccount(page.data.entries, a.id)) }));
  if (accounts.length === 0) notFound();
  return (
    <BaShell page={page} active="scan">
      <h2 className="text-xl font-extrabold text-ink">{t("scanReceipt")}</h2>
      <ScanReceipt ownerId={page.ctx.ownerId} ownerQs={page.ownerQs} accounts={accounts} stages={page.data.stages} today={todayIso()} />
    </BaShell>
  );
}
