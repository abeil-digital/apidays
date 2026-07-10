import type { Demande } from "@/lib/types";
import { ListCard } from "@/components/ui/ListCard";
import { EmptyRow } from "@/components/ui/EmptyRow";
import { RequestRow } from "@/components/demandes/RequestRow";

interface RequestListProps {
  demandes: Demande[];
  emptyText: string;
}

export function RequestList({ demandes, emptyText }: RequestListProps) {
  if (demandes.length === 0) {
    return <EmptyRow text={emptyText} />;
  }

  return (
    <ListCard>
      {demandes.map((demande, i) => (
        <RequestRow key={demande.id} demande={demande} isLast={i === demandes.length - 1} />
      ))}
    </ListCard>
  );
}
