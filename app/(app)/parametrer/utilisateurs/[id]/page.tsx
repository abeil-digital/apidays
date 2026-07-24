import { UtilisateurFichePage } from "@/components/parametrer/UtilisateurFichePage";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function Page({ params }: PageProps) {
  const { id } = await params;
  return <UtilisateurFichePage id={id} />;
}
