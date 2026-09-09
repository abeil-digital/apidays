"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { useFaqs } from "@/hooks/useFaqs";

/**
 * Card FAQ (20/08/2026, premier jet ; refonte 21/08/2026 sur maquette de
 * référence fournie, puis 21/08/2026 sur demande explicite) — bords carrés
 * (pas de `rounded-*`), pas de bordure ni d'ombre. Padding horizontal propre
 * conservé (`px-8 md:px-12`, comme le padding vertical) — l'essai "sans
 * gouttière gauche/droite" du même jour a été annulé sur demande explicite.
 * Titre "Questions fréquentes" même typo que le `<h1>`
 * "Bonjour, {prénom}" (`text-2xl font-semibold`, pas de soulignement — la
 * maquette de référence soulignait, mais demande explicite d'aligner sur le
 * style de titre déjà utilisé ailleurs sur Accueil). Intitulés de question
 * même typo que les pastilles de sélection de période du calendrier ("2026"
 * / "Juin 26 → Mai 27" / "2027", `text-sm font-semibold`) — déjà le cas ici,
 * conservé tel quel. Accordéon de questions à droite (une seule dépliée à la
 * fois, réponse affichée en dessous de la question elle-même plutôt que dans
 * un panneau séparé). Empilé en une seule colonne sous `md:`. Contenu géré
 * depuis Paramétrer > FAQ (07/09/2026, remplace le contenu provisoire en
 * dur) — `useFaqs()` ne renvoie ici que les FAQ publiées (RLS, un
 * collaborateur ne voit jamais les brouillons), déjà triées par `ordre`.
 * Rien affiché tant que le chargement est en cours ou si aucune FAQ n'est
 * publiée, plutôt qu'une card vide.
 *
 * Bord droit collé à celui du conteneur applicatif (`[data-app-content]`
 * dans `AppShell.tsx`, plafonné à `md:max-w-[1180px]` — pas le bord de
 * l'écran : un essai du 07/09/2026 allait jusqu'à `window.innerWidth`,
 * débordant largement au-delà de 1180px sur grand écran, corrigé le même
 * jour). Bord gauche passant SOUS le rail `SideNav` jusqu'à son bord gauche
 * à lui (07/09/2026, demande explicite — un essai antérieur, 21/08/2026,
 * s'arrêtait collé à droite du rail sans passer dessous, décision annulée
 * depuis) : `SideNav` reste visuellement au-dessus (`z-40`), le fond jaune
 * n'est donc visible que dans les interstices de son propre contenu.
 * Padding gauche recalculé en JS pour compenser ce débord et garder le
 * titre/texte à la même position qu'avant (pas sous le rail, seul le fond
 * l'est). Repères stables : l'espaceur invisible du rail
 * (`data-sidenav-spacer` dans `SideNav.tsx`, largeur fixe même si la nav
 * elle-même s'élargit au survol en `absolute`) et le conteneur applicatif
 * (`data-app-content`) — leurs bords donnent les positions exactes à coller.
 * Calculé à partir du PARENT de cette card (pas d'elle-même) : mesurer
 * `conteneurRef` directement une fois son propre `marginLeft` appliqué
 * aurait re-mesuré une position déjà décalée par nous, faussant tout
 * recalcul suivant (piège rencontré sur un essai précédent). Le parent, lui,
 * n'est jamais modifié, donc stable et rejouable au resize sans boucle de
 * rétroaction.
 */
export function FaqCard() {
  const { faqs, loading } = useFaqs();
  const [selectionId, setSelectionId] = useState<string>("");
  const conteneurRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ margeGauche: 0, largeur: 0, gouttiere: 32 });

  // Sélection par défaut sur la première FAQ une fois chargée (07/09/2026,
  // ne peut plus être calculée en synchrone comme avec l'ancien tableau en
  // dur). Ajustement pendant le rendu plutôt que dans un effect (pattern
  // documenté React — "adjusting state as you render") : `initialise` garde
  // ce réglage à usage unique, sans quoi rouvrir la 1ère FAQ écraserait un
  // repli volontaire du collaborateur (`selectionId` remis à "" au clic).
  const [initialise, setInitialise] = useState(false);
  if (!initialise && faqs.length > 0) {
    setInitialise(true);
    setSelectionId(faqs[0].id);
  }

  useEffect(() => {
    function recalculer() {
      const parent = conteneurRef.current?.parentElement;
      const spacer = document.querySelector("[data-sidenav-spacer]");
      if (!parent) return;
      const naturelGauche = parent.getBoundingClientRect().left;
      // Bord gauche du rail, pas son bord droit (07/09/2026, demande
      // explicite : "le fond jaune doit passer sous la navigation
      // secondaire") — le fond s'étend désormais SOUS le rail (`SideNav`,
      // `z-40`, opaque) jusqu'au bord gauche du site plutôt que de s'arrêter
      // pile à sa droite ; `SideNav` reste au-dessus visuellement (z-index
      // supérieur), seul son contenu propre (icônes/libellés) masque le
      // jaune dans cette zone.
      const railGauche = spacer ? spacer.getBoundingClientRect().left : naturelGauche;
      // Gouttière `px-8`/`md:px-12` d'origine, reprise ici en JS : le fond
      // déborde désormais sous le rail (marge négative), il faut donc
      // rajouter la largeur du débord au padding gauche du CONTENU pour que
      // le titre/texte restent au même endroit qu'avant plutôt que de
      // glisser eux aussi sous le rail (07/09/2026, régression trouvée en
      // vérifiant le point précédent).
      const gouttiere = window.matchMedia("(min-width: 768px)").matches ? 48 : 32;
      // Bord droit du conteneur applicatif (`AppShell`, `md:max-w-[1180px]`),
      // pas celui de l'écran (07/09/2026, corrige un débord excessif sur
      // grand écran — l'app plafonne volontairement sa largeur de travail à
      // 1180px, le reste de l'écran reste blanc par choix, voir AppShell.tsx).
      const conteneurApp = document.querySelector("[data-app-content]");
      const bordDroit = conteneurApp
        ? conteneurApp.getBoundingClientRect().right
        : window.innerWidth;
      setDimensions({
        margeGauche: railGauche - naturelGauche,
        largeur: bordDroit - railGauche,
        gouttiere,
      });
    }
    recalculer();
    window.addEventListener("resize", recalculer);
    return () => window.removeEventListener("resize", recalculer);
    // `faqs` en dépendance (07/09/2026, bug trouvé en vérifiant le point
    // ci-dessus) — tant que le chargement de `useFaqs()` n'est pas terminé,
    // le composant rend `null` (voir plus bas) : `conteneurRef.current` est
    // alors `null` au premier passage de cet effect, qui sortait aussitôt
    // (`if (!parent) return`) sans jamais se redéclencher une fois le
    // contenu réel monté (dépendances `[]` à l'origine) — la marge restait
    // figée à 0, le fond ne débordait donc plus du tout.
  }, [faqs]);

  if (loading || faqs.length === 0) return null;

  return (
    <div
      ref={conteneurRef}
      className="overflow-hidden bg-[#FCEFB3]/50 py-8 pr-8 md:py-12 md:pr-12"
      style={{
        width: dimensions.largeur || "100%",
        marginLeft: dimensions.margeGauche,
        paddingLeft: dimensions.gouttiere - dimensions.margeGauche,
      }}
    >
      <div className="flex flex-col gap-8 md:flex-row md:gap-16">
        <div className="shrink-0 md:w-72">
          <h2 className="text-ink-900 text-2xl font-semibold">Questions fréquentes</h2>
          <p className="text-ink-500 mt-2 text-sm">
            Comprendre les quelques principes qui encadrent les congés
          </p>
        </div>
        <div className="flex min-w-0 flex-col md:w-[400px]">
          {faqs.map((faq) => {
            const active = faq.id === selectionId;
            return (
              <div key={faq.id} className="py-4 first:pt-0 last:pb-0">
                <button
                  type="button"
                  onClick={() => setSelectionId(active ? "" : faq.id)}
                  className="text-ink-900 flex w-full items-center justify-between gap-3 text-left text-base font-semibold"
                >
                  {faq.question}
                  {active ? (
                    <ChevronUp size={16} className="text-ink-500 shrink-0" />
                  ) : (
                    <ChevronDown size={16} className="text-ink-500 shrink-0" />
                  )}
                </button>
                {active && (
                  <p className="text-ink-900 mt-2 text-sm leading-relaxed">{faq.reponse}</p>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
