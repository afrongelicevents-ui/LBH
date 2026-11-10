/** Page/section title in the LBH serif — no decorative rules. */
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
    <Tag className={`ds-h2 text-center ${light ? "text-white" : "text-charcoal"}`}>
      {children}
    </Tag>
  );
}
