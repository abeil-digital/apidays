"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Toast } from "@/components/ui/Toast";

/**
 * Confirmation après création d'un tenant (09/09/2026) — `nom` vient du
 * paramètre `?cree=` posé par `app/admin/nouveau/page.tsx` avant la
 * redirection vers `/admin`. `router.replace` à la fermeture pour retirer
 * les paramètres de l'URL (évite de réafficher le toast à un rechargement).
 * `emailEchoue` (09/09/2026) : posé quand `creerTenant` a réussi mais
 * l'envoi de l'e-mail d'invitation via Resend a échoué (voir
 * `lib/resend/invitation.ts`) — tenant/compte quand même créés, juste
 * l'e-mail à transmettre autrement pour cette fois.
 */
export function TenantsToast({
  nomCree,
  emailEchoue,
}: {
  nomCree: string | undefined;
  emailEchoue?: string;
}) {
  const router = useRouter();
  const [visible, setVisible] = useState(Boolean(nomCree));

  if (!visible || !nomCree) return null;

  return (
    <Toast
      message={
        emailEchoue
          ? `Tenant ${nomCree} créé, mais l'envoi de l'e-mail d'invitation a échoué.`
          : `Tenant ${nomCree} créé. Invitation envoyée au premier admin.`
      }
      tone={emailEchoue ? "error" : "success"}
      onClose={() => {
        setVisible(false);
        router.replace("/admin");
      }}
    />
  );
}
