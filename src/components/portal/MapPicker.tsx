"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import "leaflet/dist/leaflet.css";

/**
 * Optional map pin (brief §5.2) — OpenStreetMap/Leaflet.
 * Click to drop a pin; writes pin_lat / pin_lng hidden inputs.
 */
export default function MapPicker() {
  const t = useTranslations("portal.forms");
  const mapRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ lat: number; lng: number } | null>(null);

  useEffect(() => {
    let destroyed = false;
    let map: import("leaflet").Map | null = null;

    void (async () => {
      const L = (await import("leaflet")).default;
      if (destroyed || !mapRef.current) return;
      map = L.map(mapRef.current).setView([-19.0154, 29.1549], 6); // Zimbabwe
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: "© OpenStreetMap contributors",
      }).addTo(map);
      let marker: import("leaflet").CircleMarker | null = null;
      map.on("click", (e: import("leaflet").LeafletMouseEvent) => {
        setPos({ lat: e.latlng.lat, lng: e.latlng.lng });
        if (marker) marker.remove();
        marker = L.circleMarker(e.latlng, {
          radius: 8,
          color: "#163A2B",
          fillColor: "#C9A227",
          fillOpacity: 0.9,
        }).addTo(map!);
      });
    })();

    return () => {
      destroyed = true;
      map?.remove();
    };
  }, []);

  return (
    <div>
      <div
        ref={mapRef}
        className="h-56 w-full overflow-hidden rounded-xl border border-line"
        aria-label={t("mapAria")}
      />
      <p className="mt-1.5 text-xs text-muted">
        {pos
          ? `${t("pinSet")}: ${pos.lat.toFixed(5)}, ${pos.lng.toFixed(5)}`
          : t("pinHint")}
      </p>
      <input type="hidden" name="pin_lat" value={pos?.lat ?? ""} />
      <input type="hidden" name="pin_lng" value={pos?.lng ?? ""} />
    </div>
  );
}
