import { Suspense } from "react";
import { SuivreDemandesPage } from "@/components/suivre/SuivreDemandesPage";

export default function Page() {
  return (
    <Suspense>
      <SuivreDemandesPage />
    </Suspense>
  );
}
