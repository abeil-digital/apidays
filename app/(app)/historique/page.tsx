import { Suspense } from "react";
import { HistoriquePage } from "@/components/historique/HistoriquePage";

export default function Page() {
  return (
    <Suspense>
      <HistoriquePage />
    </Suspense>
  );
}
