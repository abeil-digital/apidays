"use client";

import { useRouter } from "next/navigation";
import { PoserDemandeModal } from "@/components/nouvelle-demande/PoserDemandeModal";

export default function Page() {
  const router = useRouter();
  return <PoserDemandeModal onClose={() => router.push("/")} />;
}
