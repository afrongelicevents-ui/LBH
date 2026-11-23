import Image from "next/image";
import { LOGOS } from "@/config/photos";

/**
 * The LBH logo (Warm Sand). Dark letters on light backgrounds, cream letters
 * in dark mode — or always cream (`onPhoto`) over photos and dark panels.
 */
export default function Logo({ className = "h-10 w-auto", onPhoto = false, priority = false }: { className?: string; onPhoto?: boolean; priority?: boolean }) {
  const img = (src: string, extra: string) => (
    <Image src={src} alt="" width={LOGOS.width} height={LOGOS.height} priority={priority} className={`${className} ${extra}`} />
  );
  if (onPhoto) return img(LOGOS.onDark, "");
  return (
    <>
      {img(LOGOS.onLight, "dark:hidden")}
      {img(LOGOS.onDark, "hidden dark:block")}
    </>
  );
}
