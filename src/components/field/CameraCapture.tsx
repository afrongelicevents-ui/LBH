"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import type { OutboxFile } from "@/lib/field/outbox";

/**
 * In-app camera for field staff. Photos and videos can ONLY be taken live
 * with the phone's camera here — there is no way to pick a file from the
 * gallery. The phone's time and GPS are recorded at the moment of capture.
 */

export type Captured = OutboxFile & { previewUrl: string };

const MAX_VIDEO_SECONDS = 60;
const MAX_PHOTO_EDGE = 2560;
const GPS_FRESH_MS = 2 * 60 * 1000;

interface Fix {
  lat: number;
  lng: number;
  accuracy: number;
  at: number;
}

function pickVideoType(): string {
  if (typeof MediaRecorder === "undefined") return "";
  const options = [
    "video/mp4;codecs=avc1",
    "video/mp4",
    "video/webm;codecs=vp9,opus",
    "video/webm;codecs=vp8,opus",
    "video/webm",
  ];
  return options.find((t) => MediaRecorder.isTypeSupported(t)) ?? "";
}

function stamp(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

export default function CameraCapture({
  mode,
  multiple = true,
  value,
  onChange,
  label,
}: {
  mode: "photo" | "video";
  multiple?: boolean;
  value: Captured[];
  onChange: (files: Captured[]) => void;
  label?: string;
}) {
  const t = useTranslations("field.camera");
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fix, setFix] = useState<Fix | null>(null);
  const [gpsState, setGpsState] = useState<"waiting" | "ok" | "off">("waiting");
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [flash, setFlash] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const watchRef = useRef<number | null>(null);
  const fixRef = useRef<Fix | null>(null);
  const valueRef = useRef(value);
  valueRef.current = value;

  const stopAll = useCallback(() => {
    streamRef.current?.getTracks().forEach((tr) => tr.stop());
    streamRef.current = null;
    if (watchRef.current !== null) navigator.geolocation?.clearWatch(watchRef.current);
    watchRef.current = null;
  }, []);

  useEffect(() => stopAll, [stopAll]);

  // Revoke preview URLs of removed items
  useEffect(() => {
    return () => value.forEach((v) => URL.revokeObjectURL(v.previewUrl));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** A capture made before the first GPS fix gets the fix that follows it. */
  const fillGps = useCallback(
    (f: Fix) => {
      const missing = valueRef.current.some(
        (c) => c.lat === null && f.at - Date.parse(c.capturedAt) < 60000
      );
      if (!missing) return;
      onChange(
        valueRef.current.map((c) =>
          c.lat === null && f.at - Date.parse(c.capturedAt) < 60000
            ? { ...c, lat: f.lat, lng: f.lng, accuracy: Math.round(f.accuracy) }
            : c
        )
      );
    },
    [onChange]
  );

  async function openCamera() {
    setError(null);
    if (!navigator.mediaDevices?.getUserMedia) {
      setError(t("noCamera"));
      return;
    }
    setOpen(true);
    // GPS: start watching as soon as the camera opens
    if (navigator.geolocation) {
      setGpsState("waiting");
      watchRef.current = navigator.geolocation.watchPosition(
        (pos) => {
          const f = {
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            accuracy: pos.coords.accuracy,
            at: Date.now(),
          };
          fixRef.current = f;
          setFix(f);
          setGpsState("ok");
          fillGps(f);
        },
        () => setGpsState((s) => (fixRef.current ? s : "off")),
        { enableHighAccuracy: true, maximumAge: 30000, timeout: 30000 }
      );
    } else {
      setGpsState("off");
    }
    try {
      const video: MediaTrackConstraints = {
        facingMode: { ideal: "environment" },
        width: { ideal: mode === "photo" ? 2560 : 1280 },
        height: { ideal: mode === "photo" ? 1920 : 720 },
      };
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video, audio: mode === "video" });
      } catch (e) {
        if (mode !== "video") throw e;
        stream = await navigator.mediaDevices.getUserMedia({ video, audio: false });
      }
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
      }
    } catch {
      setError(t("denied"));
      close();
    }
  }

  function close() {
    if (recorderRef.current && recorderRef.current.state !== "inactive") {
      recorderRef.current.stop();
    }
    stopAll();
    setOpen(false);
    setRecording(false);
  }

  function currentGps(now: number) {
    const f = fixRef.current;
    if (f && now - f.at < GPS_FRESH_MS) {
      return { lat: f.lat, lng: f.lng, accuracy: Math.round(f.accuracy) };
    }
    return { lat: null, lng: null, accuracy: null };
  }

  function add(item: Captured) {
    const next = multiple ? [...valueRef.current, item] : [item];
    if (!multiple) valueRef.current.forEach((v) => URL.revokeObjectURL(v.previewUrl));
    onChange(next);
  }

  function takePhoto() {
    const v = videoRef.current;
    if (!v || !v.videoWidth) return;
    const now = Date.now();
    const scale = Math.min(1, MAX_PHOTO_EDGE / Math.max(v.videoWidth, v.videoHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(v.videoWidth * scale);
    canvas.height = Math.round(v.videoHeight * scale);
    canvas.getContext("2d")?.drawImage(v, 0, 0, canvas.width, canvas.height);
    setFlash(true);
    setTimeout(() => setFlash(false), 150);
    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        const at = new Date(now);
        add({
          blob,
          name: `photo-${stamp(at)}.jpg`,
          type: "image/jpeg",
          capturedAt: at.toISOString(),
          ...currentGps(now),
          clientRef: crypto.randomUUID(),
          previewUrl: URL.createObjectURL(blob),
        });
        if (!multiple) close();
      },
      "image/jpeg",
      0.88
    );
  }

  function startRecording() {
    const stream = streamRef.current;
    if (!stream) return;
    const mimeType = pickVideoType();
    if (!mimeType) {
      setError(t("noRecorder"));
      return;
    }
    const startedAt = Date.now();
    const gps = currentGps(startedAt);
    const chunks: Blob[] = [];
    const rec = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 2_500_000 });
    rec.ondataavailable = (e) => e.data.size > 0 && chunks.push(e.data);
    rec.onstop = () => {
      const type = mimeType.startsWith("video/mp4") ? "video/mp4" : "video/webm";
      const blob = new Blob(chunks, { type });
      if (blob.size === 0) return;
      const at = new Date(startedAt);
      add({
        blob,
        name: `video-${stamp(at)}.${type === "video/mp4" ? "mp4" : "webm"}`,
        type,
        capturedAt: at.toISOString(),
        ...(gps.lat === null ? currentGps(Date.now()) : gps),
        clientRef: crypto.randomUUID(),
        previewUrl: URL.createObjectURL(blob),
      });
      close();
    };
    rec.start(1000);
    recorderRef.current = rec;
    setRecording(true);
    setSeconds(0);
    const timer = window.setInterval(() => {
      const s = Math.round((Date.now() - startedAt) / 1000);
      setSeconds(s);
      if (s >= MAX_VIDEO_SECONDS || rec.state === "inactive") {
        window.clearInterval(timer);
        if (rec.state !== "inactive") rec.stop();
      }
    }, 250);
  }

  function stopRecording() {
    if (recorderRef.current && recorderRef.current.state !== "inactive") {
      recorderRef.current.stop();
    }
    setRecording(false);
  }

  function remove(i: number) {
    URL.revokeObjectURL(value[i].previewUrl);
    onChange(value.filter((_, j) => j !== i));
  }

  return (
    <div>
      {value.length > 0 && (
        <ul className="mb-2 grid grid-cols-3 gap-2">
          {value.map((c, i) => (
            <li key={c.clientRef} className="relative overflow-hidden rounded-lg border border-line bg-black">
              {c.type.startsWith("image/") ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={c.previewUrl} alt="" className="aspect-square w-full object-cover" />
              ) : (
                <video src={c.previewUrl} muted playsInline className="aspect-square w-full object-cover" />
              )}
              <span className="absolute right-0 bottom-0 left-0 bg-black/60 px-1 py-0.5 text-[10px] leading-tight text-white">
                {new Date(c.capturedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                {" · "}
                {c.lat !== null ? `GPS ±${c.accuracy ?? "?"} m` : t("noGps")}
              </span>
              <button
                type="button"
                onClick={() => remove(i)}
                aria-label={t("remove")}
                className="absolute top-1 right-1 flex h-7 w-7 items-center justify-center rounded-full bg-black/70 text-sm font-bold text-white"
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}

      {(multiple || value.length === 0) && (
        <button
          type="button"
          onClick={openCamera}
          className="btn btn-green min-h-11 w-full text-sm"
          data-testid={`open-camera-${mode}`}
        >
          {label ?? (mode === "photo" ? t("takePhoto") : t("recordVideo"))}
        </button>
      )}
      {error && (
        <p role="alert" className="mt-2 text-xs font-bold text-red-700">
          {error}
        </p>
      )}

      {open && (
        <div className="fixed inset-0 z-[60] flex flex-col bg-black" role="dialog" aria-modal="true" aria-label={t("cameraTitle")}>
          <div className="flex items-center justify-between px-4 py-3 text-xs font-semibold text-white">
            <span>
              {gpsState === "ok" && fix
                ? `GPS ✓ ±${Math.round(fix.accuracy)} m`
                : gpsState === "waiting"
                  ? t("findingGps")
                  : t("gpsOff")}
            </span>
            {recording && (
              <span className="rounded-full bg-red-600 px-2 py-0.5 font-bold">
                ● {seconds}s / {MAX_VIDEO_SECONDS}s
              </span>
            )}
            {mode === "photo" && multiple && value.length > 0 && (
              <span>{t("taken", { count: value.length })}</span>
            )}
          </div>
          <div className="relative flex-1 overflow-hidden">
            <video ref={videoRef} autoPlay playsInline muted className="h-full w-full object-contain" />
            {flash && <div className="absolute inset-0 bg-white/70" />}
          </div>
          <div className="flex items-center justify-between gap-3 px-6 py-5">
            <button
              type="button"
              onClick={close}
              className="min-h-11 rounded-full border border-white/60 px-4 text-sm font-semibold text-white"
            >
              {mode === "photo" && value.length > 0 ? t("done") : t("cancel")}
            </button>
            {mode === "photo" ? (
              <button
                type="button"
                onClick={takePhoto}
                aria-label={t("shutter")}
                data-testid="shutter"
                className="h-18 w-18 rounded-full border-4 border-white bg-white/90 active:scale-95"
              />
            ) : recording ? (
              <button
                type="button"
                onClick={stopRecording}
                aria-label={t("stop")}
                data-testid="stop-recording"
                className="flex h-18 w-18 items-center justify-center rounded-full border-4 border-white"
              >
                <span className="h-7 w-7 rounded-sm bg-red-600" />
              </button>
            ) : (
              <button
                type="button"
                onClick={startRecording}
                aria-label={t("record")}
                data-testid="start-recording"
                className="flex h-18 w-18 items-center justify-center rounded-full border-4 border-white"
              >
                <span className="h-12 w-12 rounded-full bg-red-600" />
              </button>
            )}
            <span className="w-16" />
          </div>
        </div>
      )}
    </div>
  );
}
