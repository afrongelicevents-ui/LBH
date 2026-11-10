import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { formatCents } from "@/lib/money";
import { loadBaPage } from "@/lib/buildAccount/page";
import * as M from "@/lib/buildAccount/math";
import BaShell from "@/components/buildAccount/BaShell";
import { InviteForm, MemberControls, AddAccountForm } from "@/components/buildAccount/FamilyForms";
import { StatusBadge } from "@/components/ui/Portal";
import { UsersIcon } from "@/components/ui/PortalIcons";

/** Build Account — Family: who can see / add receipts; family accounts. */
export default async function FamilyPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const page = await loadBaPage(locale);
  if (!page.ctx.isOwner) notFound();
  const t = await getTranslations("ba");
  const { data } = page;
  const clean = (s: string) => s.replace(/^SAMPLE\s+/, "");

  return (
    <BaShell page={page} active="family">
      <section className="card p-4" data-testid="ba-members">
        <h2 className="flex items-center gap-2 text-base font-extrabold text-ink">
          <UsersIcon size={18} className="text-forest" />
          {t("familyTitle")}
        </h2>
        {data.members.length === 0 ? (
          <p className="mt-2 text-sm text-muted">{t("noFamily")}</p>
        ) : (
          <ul className="mt-2 divide-y divide-[#eef0ef]">
            {data.members.map((m) => {
              const held = data.accounts.find((a) => a.holder_member_id === m.id);
              return (
                <li key={m.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm">
                  <span>
                    <strong>{clean(m.name)}</strong>
                    <span className="text-muted"> · {m.whatsapp || m.email}</span>
                    <span className="mt-1 flex flex-wrap gap-1.5">
                      <StatusBadge tone={m.status === "active" ? "ok" : "prog"}>{t(`memberStatus.${m.status}` as never)}</StatusBadge>
                      <StatusBadge tone="done" dot={false}>{t(`role.${m.role}` as never)}</StatusBadge>
                      {held && (
                        <StatusBadge tone="grey" dot={false}>
                          {t("holds", { amount: formatCents(M.balance(M.inAccount(data.entries, held.id))) })}
                        </StatusBadge>
                      )}
                    </span>
                  </span>
                  {page.writable && <MemberControls memberId={m.id} role={m.role} />}
                </li>
              );
            })}
          </ul>
        )}
      </section>
      {page.writable && (
        <>
          <InviteForm />
          <AddAccountForm members={data.members.filter((m) => m.status !== "removed").map((m) => ({ id: m.id, name: clean(m.name) }))} />
        </>
      )}
    </BaShell>
  );
}
