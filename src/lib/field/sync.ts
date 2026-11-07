"use client";

import { directUpload } from "@/lib/directUpload";
import {
  saveVisit,
  saveLegal,
  uploadMedia,
  saveReportDraft,
} from "@/app/[locale]/field/actions";
import { addStagePhotos, recordPurchase, submitInspection } from "@/app/actions/stages";
import { deleteOp, listOps, putOp, type OutboxOp } from "./outbox";

type Result = { ok: true } | { ok: false; error: string };

/** Errors that fix themselves (network, session, server hiccup): retry. */
const RETRY = new Set(["auth", "error", "db", "upload", "rate"]);
/** After this many server-side failures a "retry" item needs the user. */
const MAX_ATTEMPTS = 6;

class Offline extends Error {}

function formFrom(op: OutboxOp): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(op.fields)) fd.set(k, v);
  fd.set("client_ref", op.id);
  return fd;
}

async function uploadFiles(op: OutboxOp, fd: FormData): Promise<Result | null> {
  if (op.files.length === 0) return null;
  let up;
  try {
    up = await directUpload(
      "staff-media",
      op.files.map((f) => ({
        blob: f.blob,
        name: f.name,
        type: f.type,
        meta: {
          source: "camera",
          capturedAt: f.capturedAt,
          lat: f.lat,
          lng: f.lng,
          accuracy: f.accuracy,
          clientRef: f.clientRef,
        },
      }))
    );
  } catch {
    throw new Offline();
  }
  if (!up.ok) {
    return {
      ok: false,
      error: up.error === "size" ? "toobig" : up.error === "type" ? "filetype" : up.error,
    };
  }
  fd.set("uploads_json", JSON.stringify(up.refs));
  return null;
}

async function send(op: OutboxOp): Promise<Result> {
  const fd = formFrom(op);
  const uploadFail = await uploadFiles(op, fd);
  if (uploadFail) return uploadFail;
  try {
    switch (op.action) {
      case "job-media":
        return await uploadMedia(op.target, null, fd);
      case "job-visit":
        return await saveVisit(op.target, null, fd);
      case "job-legal":
        return await saveLegal(op.target, null, fd);
      case "job-report":
        return await saveReportDraft(op.target, null, fd);
      case "stage-photos":
        return await addStagePhotos(
          op.target,
          (op.extra ?? "progress") as "delivery" | "progress" | "inspection",
          null,
          fd
        );
      case "stage-purchase":
        return await recordPurchase(op.target, null, fd);
      case "stage-inspection":
        return await submitInspection(op.target, null, fd);
      default:
        return { ok: false, error: "invalid" };
    }
  } catch {
    // Server action request failed to reach the server.
    throw new Offline();
  }
}

let running: Promise<number> | null = null;

/**
 * Send waiting items, oldest first. Stops at the first sign of no
 * connection (the rest stay on the phone). Returns how many were sent.
 */
export function flushOutbox(userId: string): Promise<number> {
  if (running) return running;
  const work = async () => {
    let sent = 0;
    const ops = (await listOps(userId)).filter((o) => o.state === "waiting");
    for (const op of ops) {
      if (typeof navigator !== "undefined" && navigator.onLine === false) break;
      let res: Result;
      try {
        res = await send(op);
      } catch (e) {
        if (e instanceof Offline) break;
        res = { ok: false, error: "error" };
      }
      if (res.ok) {
        await deleteOp(op.id);
        sent++;
        continue;
      }
      const attempts = op.attempts + 1;
      const retry = RETRY.has(res.error) && (res.error === "auth" || attempts < MAX_ATTEMPTS);
      await putOp({ ...op, attempts, lastError: res.error, state: retry ? "waiting" : "failed" });
      // Logged out or session expired: nothing else will go through either.
      if (res.error === "auth") break;
    }
    return sent;
  };
  const locked: Promise<number> =
    typeof navigator !== "undefined" && navigator.locks
      ? (navigator.locks.request("lbh-outbox", work) as unknown as Promise<number>)
      : work();
  running = locked.finally(() => {
    running = null;
  });
  return running;
}
