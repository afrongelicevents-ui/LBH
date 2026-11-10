import Image from "next/image";

export interface PhotoSource {
  src: string;
  /** "stock" photos carry a visible credit; "lbh" = a genuine LBH photo */
  kind: "stock" | "lbh";
  credit?: string;
  alt: string;
}

/**
 * A photograph with an honest label: stock photos always show a small
 * credit ("Stock photo · …") so they are never mistaken for LBH projects.
 */
export default function Photo({
  photo,
  sizes,
  priority = false,
  className = "",
  creditClassName = "",
  stockLabel,
}: {
  photo: PhotoSource;
  sizes: string;
  priority?: boolean;
  className?: string;
  creditClassName?: string;
  stockLabel: string;
}) {
  return (
    <figure className={`relative overflow-hidden ${className}`}>
      <Image src={photo.src} alt={photo.alt} fill sizes={sizes} priority={priority} className="object-cover" />
      {photo.kind === "stock" && (
        <figcaption
          className={`absolute right-0 bottom-0 max-w-[85%] truncate bg-charcoal/55 px-2 py-0.5 text-[10px] leading-4 text-white/90 ${creditClassName}`}
        >
          {stockLabel}
          {photo.credit ? ` · ${photo.credit}` : ""}
        </figcaption>
      )}
    </figure>
  );
}
