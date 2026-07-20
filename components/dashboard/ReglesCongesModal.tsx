import type { Soldes } from "@/lib/types";
import { formatDate } from "@/lib/format";
import { Modal } from "@/components/ui/Modal";

interface ReglesCongesModalProps {
  soldes: Soldes;
  onClose: () => void;
}

export function ReglesCongesModal({ soldes, onClose }: ReglesCongesModalProps) {
  return (
    <Modal title="Règles de congés cette année" onClose={onClose}>
      <div className="flex flex-col gap-5">
        <div>
          <h3 className="text-ink-500 text-xs font-bold uppercase">RTT imposés</h3>
          <ul className="mt-2 flex flex-col gap-1.5">
            {soldes.rttImposes.map((rtt) => (
              <li key={rtt.date} className="flex items-center justify-between text-sm">
                <span className="text-ink-500">{rtt.motif}</span>
                <span className="text-ink-900 font-bold">{formatDate(rtt.date)}</span>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h3 className="text-ink-500 text-xs font-bold uppercase">Échéances</h3>
          <ul className="mt-2 flex flex-col gap-1.5">
            <li className="flex items-center justify-between text-sm">
              <span className="text-ink-500">CP à poser avant le</span>
              <span className="text-ink-900 font-bold">{soldes.cp.conditionAccent}</span>
            </li>
            <li className="flex items-center justify-between text-sm">
              <span className="text-ink-500">RTT à poser avant le</span>
              <span className="text-ink-900 font-bold">{soldes.rtt.conditionAccent}</span>
            </li>
          </ul>
        </div>

        <p className="text-ink-500 text-xs">
          Données de démonstration — les règles définitives seront validées avec Abeil.
        </p>

        <button
          type="button"
          onClick={onClose}
          className="border-ink-300 text-ink-900 w-full rounded-full border py-2.5 text-sm font-semibold"
        >
          Fermer
        </button>
      </div>
    </Modal>
  );
}
