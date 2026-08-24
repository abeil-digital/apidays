import { CloturePaiePage } from "@/components/suivre/CloturePaiePage";
import { finDePeriode, libellePeriode } from "@/lib/periodePaie";

interface PageProps {
  params: Promise<{ debut: string }>;
}

export default async function Page({ params }: PageProps) {
  const { debut } = await params;
  const periode = { debut, fin: finDePeriode(debut) };

  return <CloturePaiePage periode={periode} titre={libellePeriode(periode)} />;
}
