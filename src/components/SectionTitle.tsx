/**
 * Centred section title with thin gold lines either side,
 * like "— Our Services —" in the approved mockups.
 */
export default function SectionTitle({
  children,
  light = false,
  as: Tag = "h2",
}: {
  children: React.ReactNode;
  light?: boolean;
  as?: "h1" | "h2" | "h3";
}) {
  return (
    <div className="flex items-center justify-center gap-4 sm:gap-6">
      <span aria-hidden className="h-px w-10 shrink-0 bg-gold sm:w-24" />
      <Tag
        className={`headline text-center text-2xl sm:text-3xl md:text-4xl ${
          light ? "text-white" : "text-forest"
        }`}
      >
        {children}
      </Tag>
      <span aria-hidden className="h-px w-10 shrink-0 bg-gold sm:w-24" />
    </div>
  );
}
