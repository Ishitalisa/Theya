import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "THEYA — Brief. Predict. Prove.",
    short_name: "THEYA",
    description:
      "Swipe categorized news briefs and take one fixed-stake daily position.",
    start_url: "/",
    display: "standalone",
    background_color: "#f1efe7",
    theme_color: "#11110f",
    orientation: "portrait-primary",
    icons: [
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],
  };
}
