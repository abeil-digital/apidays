/**
 * Génération du flux ICS des absences (25/09/2026, abonnement Proton/Google/
 * Outlook — voir `app/api/flux-calendrier/[token]/route.ts`). Fonctions pures,
 * sans dépendance : RFC 5545, fins de ligne CRLF, lignes pliées à 75 octets.
 */

export interface AbsenceIcs {
  id: string;
  prenom: string;
  nom: string;
  libelleType: string;
  enAttente: boolean;
  dateDebut: string; // YYYY-MM-DD
  demiDebut: "matin" | "apres_midi";
  dateFin: string; // YYYY-MM-DD
  demiFin: "matin" | "apres_midi";
  modifieLe: string; // ISO
}

function echapperTexte(texte: string): string {
  return texte
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

function plierLigne(ligne: string): string {
  const encodeur = new TextEncoder();
  if (encodeur.encode(ligne).length <= 75) return ligne;

  const morceaux: string[] = [];
  let courant = "";
  let octets = 0;
  let limite = 75;
  for (const caractere of ligne) {
    const taille = encodeur.encode(caractere).length;
    if (octets + taille > limite) {
      morceaux.push(courant);
      courant = "";
      octets = 0;
      limite = 74; // le pliage ajoute une espace en début de ligne suivante
    }
    courant += caractere;
    octets += taille;
  }
  morceaux.push(courant);
  return morceaux.join("\r\n ");
}

function sansTirets(dateIso: string): string {
  return dateIso.replace(/-/g, "");
}

function jourSuivant(dateIso: string): string {
  const d = new Date(`${dateIso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

function horodatageUtc(iso: string): string {
  return new Date(iso)
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}/, "");
}

const DEBUT_MATIN = "080000";
const FIN_MATIN = "120000";
const DEBUT_APRES_MIDI = "130000";
const FIN_APRES_MIDI = "180000";

function evenement(absence: AbsenceIcs, domaine: string, maintenant: string): string[] {
  const titre = `${absence.enAttente ? "[À valider] " : ""}${absence.prenom} ${absence.nom} — ${absence.libelleType}`;

  // Journée(s) entière(s) : évènement "toute la journée" ; sinon heures
  // "flottantes" (sans fuseau) — une demi-journée est datée à l'heure de
  // bureau, pas à l'heure réelle, faute de fuseau par entreprise.
  const journeeEntiere = absence.demiDebut === "matin" && absence.demiFin === "apres_midi";
  const dates = journeeEntiere
    ? [
        `DTSTART;VALUE=DATE:${sansTirets(absence.dateDebut)}`,
        `DTEND;VALUE=DATE:${sansTirets(jourSuivant(absence.dateFin))}`,
      ]
    : [
        `DTSTART:${sansTirets(absence.dateDebut)}T${
          absence.demiDebut === "matin" ? DEBUT_MATIN : DEBUT_APRES_MIDI
        }`,
        `DTEND:${sansTirets(absence.dateFin)}T${
          absence.demiFin === "matin" ? FIN_MATIN : FIN_APRES_MIDI
        }`,
      ];

  return [
    "BEGIN:VEVENT",
    `UID:${absence.id}@${domaine}`,
    `DTSTAMP:${maintenant}`,
    `LAST-MODIFIED:${horodatageUtc(absence.modifieLe)}`,
    ...dates,
    `SUMMARY:${echapperTexte(titre)}`,
    `STATUS:${absence.enAttente ? "TENTATIVE" : "CONFIRMED"}`,
    "TRANSP:TRANSPARENT",
    "END:VEVENT",
  ];
}

export function genererFluxIcs(
  absences: AbsenceIcs[],
  options: { nomCalendrier: string; domaine: string },
): string {
  const maintenant = horodatageUtc(new Date().toISOString());
  const lignes = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Apidays//Absences//FR",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${echapperTexte(options.nomCalendrier)}`,
    "REFRESH-INTERVAL;VALUE=DURATION:PT1H",
    "X-PUBLISHED-TTL:PT1H",
    ...absences.flatMap((absence) => evenement(absence, options.domaine, maintenant)),
    "END:VCALENDAR",
  ];
  return lignes.map(plierLigne).join("\r\n") + "\r\n";
}
