"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { createClient } from "@/lib/supabase/client";
import { waLink } from "@/config/site";
import { WhatsAppIcon, ArrowRightIcon } from "@/components/icons";

interface Message {
  id: string;
  client_id: string;
  sender_id: string;
  body: string;
  created_at: string;
}

/**
 * Realtime in-portal chat (brief §5.2). clientId is the thread owner;
 * meId is the signed-in user (client or admin).
 */
export default function ChatPanel({
  clientId,
  meId,
}: {
  clientId: string;
  meId: string;
}) {
  const t = useTranslations("portal.chat");
  const [supabase] = useState(() => createClient());
  const [messages, setMessages] = useState<Message[]>([]);
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [sendFailed, setSendFailed] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from("messages")
      .select("id, client_id, sender_id, body, created_at")
      .eq("client_id", clientId)
      .order("created_at", { ascending: false })
      .limit(200);
    // newest 200, shown oldest → newest
    if (data) setMessages([...data].reverse());
  }, [supabase, clientId]);

  useEffect(() => {
    const initial = setTimeout(() => void load(), 0);
    const channel = supabase
      .channel(`chat-${clientId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `client_id=eq.${clientId}`,
        },
        (payload) => {
          setMessages((prev) =>
            prev.some((m) => m.id === (payload.new as Message).id)
              ? prev
              : [...prev, payload.new as Message]
          );
        }
      )
      .subscribe();
    // Fallback polling in case realtime drops
    const interval = setInterval(load, 15000);
    return () => {
      clearTimeout(initial);
      void supabase.removeChannel(channel);
      clearInterval(interval);
    };
  }, [supabase, clientId, load]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const text = body.trim();
    if (!text) return;
    setBusy(true);
    setSendFailed(false);
    let error: unknown = null;
    try {
      ({ error } = await supabase.from("messages").insert({
        client_id: clientId,
        sender_id: meId,
        body: text.slice(0, 4000),
        read_by_client: meId === clientId,
        read_by_admin: meId !== clientId,
      }));
    } catch (err) {
      error = err;
    }
    setBusy(false);
    if (error) {
      setSendFailed(true); // keep the text so it can be sent again
    } else {
      setBody("");
      void load();
    }
  }

  return (
    <div className="card flex h-[65vh] flex-col">
      <div className="flex-1 space-y-3 overflow-y-auto p-4">
        {messages.length === 0 && (
          <p className="pt-8 text-center text-sm text-muted">{t("empty")}</p>
        )}
        {messages.map((m) => {
          const mine = m.sender_id === meId;
          return (
            <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm whitespace-pre-line ${
                  mine
                    ? "rounded-br-sm bg-forest text-white"
                    : "rounded-bl-sm bg-offwhite text-ink"
                }`}
              >
                {m.body}
                <span
                  className={`mt-1 block text-[10px] ${mine ? "text-white/60" : "text-muted"}`}
                >
                  {new Date(m.created_at).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>
      {sendFailed && (
        <p role="alert" className="border-t border-line px-4 py-2 text-xs font-semibold text-red-700">
          {t("sendFailed")}
        </p>
      )}
      <form onSubmit={send} className="flex gap-2 border-t border-line p-3">
        <input
          aria-label={t("placeholder")}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          maxLength={4000}
          placeholder={t("placeholder")}
          className="min-h-11 flex-1 rounded-full border border-line bg-white px-4 text-sm text-ink focus:border-forest focus:outline-none"
        />
        <button
          type="submit"
          disabled={busy || !body.trim()}
          aria-label={t("send")}
          className="btn btn-primary min-h-11 px-4 disabled:opacity-60"
        >
          <ArrowRightIcon width={18} height={18} />
        </button>
      </form>
      {waLink() && (
        <a
          href={waLink()!}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-2 border-t border-line py-2.5 text-xs font-semibold text-forest"
        >
          <WhatsAppIcon width={16} height={16} className="text-whatsapp" />
          {t("orWhatsapp")}
        </a>
      )}
    </div>
  );
}
