import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "LBH — Let's Build Home",
    short_name: "LBH",
    description: "Build back home — without being there.",
    start_url: "/",
    display: "standalone",
    background_color: "#F8F6F1",
    theme_color: "#163A2B",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  };
}
