import { getTranslations, setRequestLocale } from "next-intl/server";
import { requireRole } from "@/lib/auth/guard";
import ChatPanel from "@/components/portal/ChatPanel";

export default async function ClientChatPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { user } = await requireRole(locale, ["client"]);
  const t = await getTranslations("portal.chat");

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="section-title mb-4 text-2xl">{t("title")}</h1>
      <ChatPanel clientId={user.id} meId={user.id} />
    </div>
  );
}
