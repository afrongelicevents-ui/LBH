"use client";

/**
 * Field outbox: everything field staff save (photos, videos, checklists,
 * notes, reports) is first written to the phone (IndexedDB), then sent to
 * the server. With no signal the items simply wait on the phone and are
 * sent automatically when the connection returns, keeping the original
 * capture time and GPS.
 */

export type OutboxAction =
  | "job-media"
  | "job-visit"
  | "job-legal"
  | "job-report"
  | "stage-photos"
  | "stage-purchase"
  | "stage-inspection";

export interface OutboxFile {
  blob: Blob;
  name: string;
  type: string;
  capturedAt: string; // ISO, phone time at the shutter
  lat: number | null;
  lng: number | null;
  accuracy: number | null;
  clientRef: string; // uuid made at capture
}

export interface OutboxOp {
  id: string; // uuid — also the server-side idempotency key for the save
  userId: string;
  createdAt: number;
  action: OutboxAction;
  target: string; // job or stage id
  extra?: string; // e.g. stage photo kind
  /** what to show in the list ("Photo — Stand 412") */
  label: string;
  fields: Record<string, string>;
  files: OutboxFile[];
  attempts: number;
  /** waiting = will be sent automatically; failed = needs the user */
  state: "waiting" | "failed";
  lastError?: string;
}

/** Saves of the same form replace each other while still waiting. */
const COALESCE: OutboxAction[] = ["job-visit", "job-legal", "job-report"];

const DB_NAME = "lbh-field";
const STORE = "outbox";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: "id" });
        store.createIndex("userId", "userId");
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function tx<T>(
  mode: IDBTransactionMode,
  fn: (store: IDBObjectStore) => IDBRequest<T> | void
): Promise<T | undefined> {
  const db = await openDb();
  return new Promise<T | undefined>((resolve, reject) => {
    const t = db.transaction(STORE, mode);
    const store = t.objectStore(STORE);
    const req = fn(store);
    let result: T | undefined;
    if (req) req.onsuccess = () => (result = req.result);
    t.oncomplete = () => {
      db.close();
      resolve(result);
    };
    t.onerror = () => {
      db.close();
      reject(t.error);
    };
    t.onabort = () => {
      db.close();
      reject(t.error);
    };
  });
}

const listeners = new Set<() => void>();
export function onOutboxChange(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
function notify() {
  listeners.forEach((fn) => fn());
  try {
    // other tabs
    new BroadcastChannel("lbh-outbox").postMessage("changed");
  } catch {
    /* not supported */
  }
}
if (typeof window !== "undefined" && "BroadcastChannel" in window) {
  new BroadcastChannel("lbh-outbox").onmessage = () => listeners.forEach((fn) => fn());
}

export function outboxSupported(): boolean {
  return typeof indexedDB !== "undefined";
}

export async function listOps(userId: string): Promise<OutboxOp[]> {
  const all = (await tx<OutboxOp[]>("readonly", (s) => s.index("userId").getAll(userId))) ?? [];
  return all.sort((a, b) => a.createdAt - b.createdAt);
}

export async function putOp(op: OutboxOp): Promise<void> {
  await tx("readwrite", (s) => s.put(op));
  notify();
}

export async function deleteOp(id: string): Promise<void> {
  await tx("readwrite", (s) => s.delete(id));
  notify();
}

export async function enqueue(
  op: Omit<OutboxOp, "id" | "createdAt" | "attempts" | "state">
): Promise<OutboxOp> {
  const full: OutboxOp = {
    ...op,
    id: crypto.randomUUID(),
    createdAt: Date.now(),
    attempts: 0,
    state: "waiting",
  };
  if (COALESCE.includes(op.action)) {
    const older = (await listOps(op.userId)).filter(
      (o) => o.action === op.action && o.target === op.target
    );
    for (const o of older) await tx("readwrite", (s) => s.delete(o.id));
  }
  await putOp(full);
  // Ask the browser not to clear stored items when space is low.
  navigator.storage?.persist?.().catch(() => {});
  return full;
}

/** Latest not-yet-sent save of a form (to show it again after a reload). */
export async function latestPending(
  userId: string,
  action: OutboxAction,
  target: string
): Promise<OutboxOp | null> {
  const ops = (await listOps(userId)).filter((o) => o.action === action && o.target === target);
  return ops.length ? ops[ops.length - 1] : null;
}
