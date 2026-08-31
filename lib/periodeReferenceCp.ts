import type { RegleAcquisition } from "@/lib/types";

function isoDate(annee: number, moisIndex: number, jour: number): string {
  return new Date(Date.UTC(annee, moisIndex, jour)).toISOString().slice(0, 10);
}

function ajouterJoursIso(dateIso: string, n: number): string {
  const d = new Date(`${dateIso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/**
 * Fenêtre de la période de référence CP contenant `reference` (aujourd'hui
 * par défaut) — ex. pour "1er juin → 31 mai", si on est en août la période
 * va du 01/06 cette année au 31/05 l'an prochain ; si on est en mars, elle
 * va du 01/06 l'an dernier au 31/05 cette année. Sans règle CP configurée,
 * retombe sur l'année civile. Utilisé par `DashboardPage` (onglet "Période
 * de référence") et le filtre temporel de `/historique` — un seul calcul
 * partagé plutôt que deux copies qui pourraient diverger.
 */
export function periodeReferenceCp(
  regleCp: RegleAcquisition | undefined,
  reference = new Date(),
): { debut: string; fin: string } {
  const anneeRef = reference.getUTCFullYear();
  const todayIso = reference.toISOString().slice(0, 10);
  const debutAnnee = isoDate(anneeRef, 0, 1);
  const finAnnee = isoDate(anneeRef, 11, 31);

  if (!regleCp) return { debut: debutAnnee, fin: finAnnee };

  const debut =
    todayIso >= isoDate(anneeRef, regleCp.periodeDebutMois - 1, regleCp.periodeDebutJour)
      ? isoDate(anneeRef, regleCp.periodeDebutMois - 1, regleCp.periodeDebutJour)
      : isoDate(anneeRef - 1, regleCp.periodeDebutMois - 1, regleCp.periodeDebutJour);

  const fin = ajouterJoursIso(
    isoDate(Number(debut.slice(0, 4)) + 1, regleCp.periodeDebutMois - 1, regleCp.periodeDebutJour),
    -1,
  );

  return { debut, fin };
}
