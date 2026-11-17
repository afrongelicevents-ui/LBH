/**
 * LBH services, grouped the way a build happens: Land · Build · Finish.
 * Each Land/Build service has its own detail page (/services/<slug>);
 * Finish (interiors & furnishing) has its own page at /services/interiors.
 */
export const SERVICES = [
  { key: "land", slug: "land-verification", group: "land" },
  { key: "landBuying", slug: "land-buying", group: "land" },
  { key: "materials", slug: "materials", group: "build" },
  { key: "onsite", slug: "on-site-management", group: "build" },
  { key: "reporting", slug: "progress-reports", group: "build" },
] as const;

export type ServiceKey = (typeof SERVICES)[number]["key"];
export type ServiceGroupKey = "land" | "build" | "finish";

export const SERVICE_GROUP_KEYS: ServiceGroupKey[] = ["land", "build", "finish"];
export const INTERIORS_PATH = "/services/interiors";

export const servicePath = (key: ServiceKey) => `/services/${SERVICES.find((s) => s.key === key)!.slug}`;
export const serviceBySlug = (slug: string) => SERVICES.find((s) => s.slug === slug);
export const servicesIn = (group: ServiceGroupKey) => SERVICES.filter((s) => s.group === group);

/** Which website photo a service uses (land buying shares the land photo). */
export const photoKeyFor = (key: ServiceKey) => (key === "landBuying" ? "land" : key);
