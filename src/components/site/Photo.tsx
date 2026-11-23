import Image from "next/image";

export interface PhotoSource {
  src: string;
  /** "stock" photos carry a visible credit; "lbh" = a genuine LBH photo */
  kind: "stock" | "lbh";
  credit?: string;
  alt: string;
  /** CSS object-position for the crop, e.g. "50% 20%" */
  position?: string;
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
  hideCredit = false,
}: {
  photo: PhotoSource;
  sizes: string;
  priority?: boolean;
  className?: string;
  creditClassName?: string;
  /** "Stock photo" (translated); needed unless hideCredit */
  stockLabel?: string;
  /** Leave the credit off the image; it must then be listed on About → Photo credits. */
  hideCredit?: boolean;
}) {
  return (
    <figure className={`${/(^|\s)(absolute|fixed)(\s|$)/.test(className) ? "" : "relative"} overflow-hidden ${className}`}>
      <Image src={photo.src} alt={photo.alt} fill sizes={sizes} priority={priority} className="object-cover" style={photo.position ? { objectPosition: photo.position } : undefined} />
      {photo.kind === "stock" && !hideCredit && (
        <figcaption
          className={`absolute right-0 bottom-0 max-w-[85%] truncate bg-[rgba(23,18,14,0.55)] px-2 py-0.5 text-[10px] leading-4 text-white/90 ${creditClassName}`}
        >
          {[stockLabel, photo.credit].filter(Boolean).join(" · ")}
        </figcaption>
      )}
    </figure>
  );
}
