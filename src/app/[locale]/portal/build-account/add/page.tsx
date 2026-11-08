import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { loadBaPage } from "@/lib/buildAccount/page";
import { accountName, receiverOf, todayIso } from "@/lib/buildAccount/view";
import BaShell from "@/components/buildAccount/BaShell";
import AddMoneyForm from "@/components/buildAccount/AddMoneyForm";

export default async function AddMoneyPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const page = await loadBaPage(locale);
  if (!page.ctx.isOwner || !page.writable) notFound();
  const t = await getTranslations("ba");
  const accounts = page.data.accounts.map((a) => {
    const who = receiverOf(a, page.ctx);
    const holder = page.data.members.find((m) => m.id === a.holder_member_id)?.name.replace(/^SAMPLE\s+/, "");
    return {
      id: a.id,
      name: accountName(page.data, a.id),
      receiver: who === "lbh" ? t("confirmedBy.lbh") : who === "member" ? t("confirmedBy.member", { name: holder ?? "" }) : t("confirmedBy.me"),
    };
  });
  return (
    <BaShell page={page} active={null}>
      <h2 className="text-xl font-extrabold text-ink">{t("addMoney")}</h2>
      <AddMoneyForm ownerId={page.ctx.ownerId} accounts={accounts} today={todayIso()} />
    </BaShell>
  );
}
