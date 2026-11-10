/** Heading used by every account section (same rhythm as the website pages). */
export default function PageHead({ eyebrow, title, intro, children }: { eyebrow: string; title: string; intro?: string; children?: React.ReactNode }) {
  return (
    <header className="flex flex-col gap-4 border-b border-rule pb-8 md:flex-row md:items-end md:justify-between">
      <div>
        <p className="ds-eyebrow">{eyebrow}</p>
        <h1 className="ds-h2 mt-2">{title}</h1>
        {intro && <p className="ds-body mt-2 max-w-2xl">{intro}</p>}
      </div>
      {children && <div className="flex flex-wrap gap-2">{children}</div>}
    </header>
  );
}
