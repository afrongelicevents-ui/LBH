/** The four v1 services (brief §2). Copy lives in messages/<locale>.json under servicesData. */
export type ServiceKey = "land" | "materials" | "monitoring" | "camera";

export interface ServiceDef {
  key: ServiceKey;
  image: string;
  /** bullet message keys present for this service */
  bullets: number;
  comingSoon: boolean;
  /** show bullets on the homepage card (mockup: monitoring shows only the pill) */
  homeBullets: boolean;
}

export const services: ServiceDef[] = [
  {
    key: "land",
    image: "/images/land.jpg",
    bullets: 4,
    comingSoon: false,
    homeBullets: true,
  },
  {
    key: "materials",
    image: "/images/materials.jpg",
    bullets: 3,
    comingSoon: false,
    homeBullets: true,
  },
  {
    key: "monitoring",
    image: "/images/monitoring.jpg",
    bullets: 3,
    comingSoon: true,
    homeBullets: false,
  },
  {
    key: "camera",
    image: "/images/camera.jpg",
    bullets: 4,
    comingSoon: true,
    homeBullets: true,
  },
];
