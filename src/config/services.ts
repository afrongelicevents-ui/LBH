/** The four services LBH offers today, and the address of each detail page. */
export const SERVICES = [
  { key: "land", slug: "land-verification" },
  { key: "materials", slug: "materials" },
  { key: "onsite", slug: "on-site-management" },
  { key: "reporting", slug: "progress-reports" },
] as const;

export type ServiceKey = (typeof SERVICES)[number]["key"];

export const servicePath = (key: ServiceKey) => `/services/${SERVICES.find((s) => s.key === key)!.slug}`;
export const serviceBySlug = (slug: string) => SERVICES.find((s) => s.slug === slug);
