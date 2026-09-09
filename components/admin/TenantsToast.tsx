"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Toast } from "@/components/ui/Toast";

/**
 * Confirmation après création d'un tenant (09/09/2026) — `nom` vient du
 * paramètre `?cree=` posé par `app/admin/nouveau/page.tsx` avant la
 * redirection vers `/admin`. `router.replace` à la fermeture pour retirer
 * le paramètre de l'URL (évite de réafficher le toast à un rechargement).
 */
export function TenantsToast({ nomCree }: { nomCree: string | undefined }) {
  const router = useRouter();
  const [visible, setVisible] = useState(Boolean(nomCree));

  if (!visible || !nomCree) return null;

  return (
    <Toast
      message={`Tenant ${nomCree} créé. Invitation envoyée au premier admin.`}
      onClose={() => {
        setVisible(false);
        router.replace("/admin");
      }}
    />
  );
}
