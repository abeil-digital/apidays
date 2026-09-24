import type { MetadataRoute } from "next";

/**
 * Web App Manifest (24/09/2026, icônes d'écran d'accueil) — nécessaire pour
 * qu'Android (Chrome "Ajouter à l'écran d'accueil") récupère une vraie icône
 * plutôt qu'une capture de la page ; `apple-icon.png` (voir app/apple-icon.png)
 * ne couvre que Safari/iOS. Icônes PNG dédiées dans `public/` (192/512 +
 * variante "maskable" avec marge de sécurité pour les découpes adaptatives
 * Android), générées depuis `app/icon.svg`.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Apidays — Espace Salarié",
    short_name: "Apidays",
    description: "Gestion des congés et RTT — Espace Salarié",
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#001e32",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      {
        src: "/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
