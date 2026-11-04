// src/app/manifest.ts

import type { MetadataRoute } from "next"

// Served at /manifest.webmanifest. Icons live in /public; the iOS home-screen
// icon itself comes from src/app/apple-icon.png (file convention).
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "YourKieke",
    short_name: "Kieke",
    description: "Shared family management",
    start_url: "/",
    display: "browser",
    background_color: "#0E5E62",
    theme_color: "#1F8A86",
    icons: [
      { src: "/kieke-icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/kieke-icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  }
}
