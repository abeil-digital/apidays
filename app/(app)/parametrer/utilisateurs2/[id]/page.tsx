import { UtilisateurFichePage2 } from "@/components/parametrer/UtilisateurFichePage2";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function Page({ params }: PageProps) {
  const { id } = await params;
  return <UtilisateurFichePage2 id={id} />;
}
