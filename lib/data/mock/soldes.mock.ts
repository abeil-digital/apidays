import type { Soldes } from "@/lib/types";

export function seedSoldes(): Soldes {
  return {
    cpReel: 18,
    cpTheorique: 4,
    rttLibresRestant: 2,
    rttLibresTotal: 3,
    rttImposesRestant: 3,
    rttImposesTotal: 3,
  };
}
