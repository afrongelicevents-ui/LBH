"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { useRouter, usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  deleteOp,
  enqueue as enqueueOp,
  listOps,
  onOutboxChange,
  outboxSupported,
  putOp,
  type OutboxOp,
} from "@/lib/field/outbox";
import { flushOutbox } from "@/lib/field/sync";

type EnqueueInput = Omit<OutboxOp, "id" | "createdAt" | "attempts" | "state" | "userId">;

interface OutboxCtx {
  userId: string;
  ops: OutboxOp[];
  online: boolean;
  enqueue: (op: EnqueueInput) => Promise<OutboxOp>;
  flush: () => void;
}

const Ctx = createContext<OutboxCtx | null>(null);

/** null outside the field area (admin / client pages send directly). */
export function useOutbox(): OutboxCtx | null {
  return useContext(Ctx);
}

const RETRY_MS = 20000;

function subscribeOnline(cb: () => void) {
  window.addEventListener("online", cb);
  window.addEventListener("offline", cb);
  return () => {
    window.removeEventListener("online", cb);
    window.removeEventListener("offline", cb);
  };
}

export default function OutboxProvider({
  userId,
  children,
}: {
  userId: string;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [ops, setOps] = useState<OutboxOp[]>([]);
  const online = useSyncExternalStore(
    subscribeOnline,
    () => navigator.onLine,
    () => true
  );
  const [syncing, setSyncing] = useState(false);
  const mounted = useRef(true);

  const reload = useCallback(async () => {
    if (!outboxSupported()) return;
    const list = await listOps(userId).catch(() => []);
    if (mounted.current) setOps(list);
  }, [userId]);

  const flush = useCallback(async () => {
    if (!outboxSupported()) return;
    setSyncing(true);
    try {
      const sent = await flushOutbox(userId);
      if (sent > 0) router.refresh();
    } catch {
      /* retried on the next tick */
    } finally {
      if (mounted.current) setSyncing(false);
      reload();
    }
  }, [userId, router, reload]);

  const enqueue = useCallback(
    async (op: EnqueueInput) => {
      const full = await enqueueOp({ ...op, userId });
      await reload();
      flush();
      return full;
    },
    [userId, reload, flush]
  );

  useEffect(() => {
    mounted.current = true;
    const first = window.setTimeout(flush, 0);
    const off = onOutboxChange(reload);
    const goOnline = () => flush();
    const visible = () => document.visibilityState === "visible" && flush();
    window.addEventListener("online", goOnline);
    document.addEventListener("visibilitychange", visible);
    const timer = window.setInterval(flush, RETRY_MS);

    // Offline page loads: cache field pages + app files (public/field-sw.js)
    if ("serviceWorker" in navigator && window.isSecureContext) {
      navigator.serviceWorker
        .register("/field-sw.js", { scope: "/" })
        .then(() => navigator.serviceWorker.ready)
        .then((reg) => {
          const urls = [
            location.pathname,
            ...performance
              .getEntriesByType("resource")
              .map((e) => e.name)
              .filter((u) => u.startsWith(`${location.origin}/_next/static/`)),
          ];
          reg.active?.postMessage({ type: "precache", urls });
        })
        .catch(() => {});
    }

    return () => {
      mounted.current = false;
      off();
      window.removeEventListener("online", goOnline);
        document.removeEventListener("visibilitychange", visible);
      window.clearInterval(timer);
      window.clearTimeout(first);
    };
  }, [reload, flush]);

  // Every field page opened (also by tapping a card) is kept for offline use.
  useEffect(() => {
    if (!("serviceWorker" in navigator) || !window.isSecureContext) return;
    navigator.serviceWorker.ready
      .then((reg) => reg.active?.postMessage({ type: "precache", urls: [pathname] }))
      .catch(() => {});
  }, [pathname]);

  return (
    <Ctx.Provider value={{ userId, ops, online, enqueue, flush }}>
      <OutboxStatus ops={ops} online={online} syncing={syncing} onRetry={flush} />
      {children}
    </Ctx.Provider>
  );
}

function OutboxStatus({
  ops,
  online,
  syncing,
  onRetry,
}: {
  ops: OutboxOp[];
  online: boolean;
  syncing: boolean;
  onRetry: () => void;
}) {
  const t = useTranslations("field.outbox");
  const te = useTranslations("field.error");
  const tb = useTranslations("build.error");
  const reason = (code: string) =>
    code === "auth"
      ? t("logInAgain")
      : te.has(code as never)
        ? te(code as never)
        : tb.has(code as never)
          ? tb(code as never)
          : te("error");
  const [open, setOpen] = useState(false);
  const failed = ops.filter((o) => o.state === "failed");
  const waiting = ops.length;

  if (waiting === 0) {
    return (
      <div role="status" data-testid="outbox-status" className="mb-3 flex items-center justify-between gap-2 rounded-xl bg-white px-3 py-2 text-xs font-bold text-forest shadow-sm">
        <span>{t("allUploaded")}</span>
        {!online && <span className="text-muted">{t("offline")}</span>}
      </div>
    );
  }

  return (
    <div role="status" data-testid="outbox-status" className="mb-3 rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-ink">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => setOpen(!open)}
          aria-expanded={open}
          className="text-left font-bold text-ink"
        >
          {t("waiting", { count: waiting })}
          <span className="ml-1 font-semibold text-muted">
            · {!online ? t("noSignal") : syncing ? t("uploadingNow") : t("willRetry")}
          </span>
        </button>
        {online && !syncing && (
          <button type="button" onClick={onRetry} className="font-bold text-forest underline underline-offset-2">
            {t("retryNow")}
          </button>
        )}
      </div>
      {failed.length > 0 && (
        <p className="mt-1 font-semibold text-red-700">{t("needsYou", { count: failed.length })}</p>
      )}
      {(open || failed.length > 0) && (
        <ul className="mt-2 space-y-1.5 border-t border-amber-200 pt-2">
          {ops.map((o) => (
            <li key={o.id} className="flex flex-wrap items-center justify-between gap-2">
              <span>
                <span className="font-semibold">{o.label}</span>
                <span className="text-muted"> · {new Date(o.createdAt).toLocaleString()}</span>
                {o.lastError && (
                  <span className={o.state === "failed" ? "text-red-700" : "text-muted"}>
                    {" "}
                    · {reason(o.lastError)}
                  </span>
                )}
              </span>
              {o.state === "failed" && (
                <span className="flex gap-3">
                  <button
                    type="button"
                    className="font-bold text-forest underline"
                    onClick={async () => {
                      await putOp({ ...o, state: "waiting", attempts: 0 });
                      onRetry();
                    }}
                  >
                    {t("tryAgain")}
                  </button>
                  <button
                    type="button"
                    className="font-bold text-red-700 underline"
                    onClick={() => {
                      if (confirm(t("removeConfirm"))) deleteOp(o.id);
                    }}
                  >
                    {t("remove")}
                  </button>
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
