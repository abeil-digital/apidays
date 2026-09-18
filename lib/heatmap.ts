// Dégradé de couleur du heatmap "Calendrier consolidé" (`CalendrierGlobal.tsx`)
// — extrait ici (18/09/2026) pour être réutilisé par la card "Collaborateurs
// en congé aujourd'hui" de l'Accueil manager/admin, sans dupliquer l'échelle.

// Dégradé orange clair → rouge foncé — 5 paliers (échelle "OrRd" ColorBrewer)
const PALIERS_HEATMAP: [number, string][] = [
  [0, "#fff7ec"],
  [25, "#fee8c8"],
  [50, "#fdbb84"],
  [75, "#e34a33"],
  [100, "#b30000"],
];

function hexVersRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function rgbVersHex([r, g, b]: [number, number, number]): string {
  return `#${[r, g, b].map((v) => Math.round(v).toString(16).padStart(2, "0")).join("")}`;
}

/** Couleur de la heatmap pour un pourcentage donné (0-100) — interpolation
 * linéaire entre les deux paliers `PALIERS_HEATMAP` encadrant `pct`. */
export function couleurHeatmap(pct: number): string {
  const clamp = Math.min(100, Math.max(0, pct));
  for (let i = 0; i < PALIERS_HEATMAP.length - 1; i++) {
    const [p0, c0] = PALIERS_HEATMAP[i];
    const [p1, c1] = PALIERS_HEATMAP[i + 1];
    if (clamp <= p1) {
      const t = (clamp - p0) / (p1 - p0);
      const rgb0 = hexVersRgb(c0);
      const rgb1 = hexVersRgb(c1);
      return rgbVersHex([
        rgb0[0] + (rgb1[0] - rgb0[0]) * t,
        rgb0[1] + (rgb1[1] - rgb0[1]) * t,
        rgb0[2] + (rgb1[2] - rgb0[2]) * t,
      ]);
    }
  }
  return PALIERS_HEATMAP[PALIERS_HEATMAP.length - 1][1];
}
