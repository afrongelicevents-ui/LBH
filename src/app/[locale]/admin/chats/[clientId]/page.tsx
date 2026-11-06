import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { requireRole } from "@/lib/auth/guard";
import ChatPanel from "@/components/portal/ChatPanel";

export default async function AdminChatThreadPage({
  params,
}: {
  params: Promise<{ locale: string; clientId: string }>;
}) {
  const { locale, clientId } = await params;
  setRequestLocale(locale);
  const { supabase, user } = await requireRole(locale, ["admin"]);
  const t = await getTranslations("admin.chats");

  const { data: client } = await supabase
    .from("profiles")
    .select("id, full_name, email")
    .eq("id", clientId)
    .maybeSingle();
  if (!client) notFound();

  // mark read
  await supabase
    .from("messages")
    .update({ read_by_admin: true })
    .eq("client_id", clientId)
    .eq("read_by_admin", false);

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div>
        <Link href="/admin/chats" className="text-xs font-semibold text-muted hover:text-forest">
          ← {t("title")}
        </Link>
        <h1 className="headline mt-1 text-2xl text-forest">
          {client.full_name || client.email}
        </h1>
      </div>
      <ChatPanel clientId={clientId} meId={user.id} />
    </div>
  );
}
