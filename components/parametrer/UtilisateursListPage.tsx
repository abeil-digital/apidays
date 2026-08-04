"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, ChevronUp, UserPlus } from "lucide-react";
import type {
  NatureContrat,
  RoleUtilisateur,
  StatutUtilisateur,
  UtilisateurAdmin,
} from "@/lib/types";
import { formatDate } from "@/lib/format";
import { useUtilisateursAdmin } from "@/hooks/useUtilisateursAdmin";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { EmptyRow } from "@/components/ui/EmptyRow";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";

const ROLE_LABEL: Record<RoleUtilisateur, string> = {
  salarie: "Salarié·e",
  manager: "Manager",
  admin: "Admin",
};

const NATURE_CONTRAT_LABEL: Record<NatureContrat, string> = {
  cdi: "CDI",
  cdd: "CDD",
  alternance: "Alternance",
  stage: "Stage",
};

function formatTauxActivite(taux: number): string {
  if (taux === 100) return "Temps plein";
  return `${new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 2 }).format(taux)}%`;
}

type Champ = "nom" | "dateEntree";
type Direction = "asc" | "desc";

interface ThTriableProps {
  label: string;
  champ: Champ;
  triActif: Champ;
  direction: Direction;
  onClick: (champ: Champ) => void;
}

function ThTriable({ label, champ, triActif, direction, onClick }: ThTriableProps) {
  const actif = champ === triActif;
  const Icon = direction === "asc" ? ChevronUp : ChevronDown;

  return (
    <th className="px-4 py-3">
      <button
        type="button"
        onClick={() => onClick(champ)}
        className={`flex items-center gap-1 text-xs font-semibold ${actif ? "text-ink-900" : "text-ink-500"}`}
      >
        {label}
        {actif && <Icon size={13} />}
      </button>
    </th>
  );
}

export function UtilisateursListPage() {
  const router = useRouter();
  const { utilisateurs, loading, error } = useUtilisateursAdmin();

  const [recherche, setRecherche] = useState("");
  const [role, setRole] = useState<RoleUtilisateur | "tous">("tous");
  const [statut, setStatut] = useState<StatutUtilisateur | "tous">("actif");
  const [natureFiltre, setNatureFiltre] = useState<NatureContrat | "tous">("tous");
  const [tri, setTri] = useState<Champ>("nom");
  const [direction, setDirection] = useState<Direction>("asc");

  function trierPar(champ: Champ) {
    if (champ === tri) {
      setDirection((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setTri(champ);
      setDirection("asc");
    }
  }

  const filtres = useMemo(() => {
    const rechercheNormalisee = recherche.trim().toLowerCase();

    return [...utilisateurs]
      .filter((u) => (statut === "tous" ? true : u.statut === statut))
      .filter((u) => (role === "tous" ? true : u.role === role))
      .filter((u) => (natureFiltre === "tous" ? true : u.natureContrat === natureFiltre))
      .filter((u) => {
        if (!rechercheNormalisee) return true;
        return `${u.nom} ${u.prenom} ${u.email}`.toLowerCase().includes(rechercheNormalisee);
      })
      .sort((a, b) => {
        const cmp =
          tri === "nom" ? a.nom.localeCompare(b.nom) : a.dateEntree.localeCompare(b.dateEntree);
        return direction === "asc" ? cmp : -cmp;
      });
  }, [utilisateurs, recherche, role, statut, natureFiltre, tri, direction]);

  function allerALaFiche(u: UtilisateurAdmin) {
    router.push(`/parametrer/utilisateurs/${u.id}`);
  }

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-5 pt-5 pb-4 md:max-w-6xl md:pt-0">
      <div className="flex items-center justify-between px-1">
        <h1 className="text-ink-900 text-2xl font-semibold">Utilisateurs</h1>
        <Button
          href="/parametrer/utilisateurs/nouveau"
          className="shrink-0 rounded-full px-4 py-2.5"
        >
          <UserPlus size={16} />
          <span className="hidden sm:inline">Créer un profil</span>
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-2 px-1">
        <Input
          type="search"
          value={recherche}
          onChange={(e) => setRecherche(e.target.value)}
          placeholder="Rechercher un nom ou un email…"
          className="min-w-48 flex-1"
        />
        <Select value={role} onChange={(e) => setRole(e.target.value as RoleUtilisateur | "tous")}>
          <option value="tous">Tous les rôles</option>
          <option value="salarie">Salarié·e</option>
          <option value="manager">Manager</option>
          <option value="admin">Admin</option>
        </Select>
        <Select
          value={statut}
          onChange={(e) => setStatut(e.target.value as StatutUtilisateur | "tous")}
        >
          <option value="actif">Actifs</option>
          <option value="archive">Archivés</option>
          <option value="tous">Tous les statuts</option>
        </Select>
        <Select
          value={natureFiltre}
          onChange={(e) => setNatureFiltre(e.target.value as NatureContrat | "tous")}
        >
          <option value="tous">Tous les contrats</option>
          <option value="cdi">CDI</option>
          <option value="cdd">CDD</option>
          <option value="alternance">Alternance</option>
          <option value="stage">Stage</option>
        </Select>
      </div>

      {error && (
        <div className="rounded-control bg-status-danger-bg text-status-danger-fg px-3 py-2.5 text-sm">
          {error}
        </div>
      )}

      {loading ? (
        <div className="text-ink-500 py-20 text-center text-sm">Chargement…</div>
      ) : filtres.length === 0 ? (
        <EmptyRow text="Aucun utilisateur ne correspond à ces filtres." />
      ) : (
        <div className="rounded-card bg-surface-card overflow-x-auto shadow-sm">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead>
              <tr className="border-ink-300 text-ink-500 border-b text-xs font-semibold">
                <ThTriable
                  label="Nom"
                  champ="nom"
                  triActif={tri}
                  direction={direction}
                  onClick={trierPar}
                />
                <th className="px-4 py-3">Prénom</th>
                <th className="px-4 py-3">Email</th>
                <ThTriable
                  label="Date d'entrée"
                  champ="dateEntree"
                  triActif={tri}
                  direction={direction}
                  onClick={trierPar}
                />
                <th className="px-4 py-3">Contrat</th>
                <th className="px-4 py-3">Rôle</th>
                <th className="px-4 py-3">Statut</th>
              </tr>
            </thead>
            <tbody>
              {filtres.map((u) => (
                <tr
                  key={u.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => allerALaFiche(u)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") allerALaFiche(u);
                  }}
                  className="border-ink-300/60 hover:bg-surface-app cursor-pointer border-b last:border-b-0"
                >
                  <td className="text-ink-900 px-4 py-3 font-semibold">{u.nom}</td>
                  <td className="px-4 py-3">{u.prenom}</td>
                  <td className="text-ink-500 px-4 py-3">{u.email}</td>
                  <td className="px-4 py-3">{formatDate(u.dateEntree)}</td>
                  <td className="px-4 py-3">
                    {u.natureContrat ? NATURE_CONTRAT_LABEL[u.natureContrat] : "Non précisé"} ·{" "}
                    {formatTauxActivite(u.tauxActivite)}
                  </td>
                  <td className="px-4 py-3">{ROLE_LABEL[u.role]}</td>
                  <td className="px-4 py-3">
                    <Badge tone={u.statut === "actif" ? "success" : "neutral"}>
                      {u.statut === "actif" ? "Actif" : "Archivé"}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
