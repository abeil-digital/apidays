// Résolveur de modules pour exécuter le moteur de solde (lib/data/soldes.repository.ts) hors navigateur :
// "@/..." → racine du dépôt, et le client Supabase navigateur → clientStub.mjs.
import { existsSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";

const ICI = path.dirname(fileURLToPath(import.meta.url));
const RACINE = path.resolve(ICI, "../..") + path.sep;

export async function resolve(specifier, contexte, suivant) {
  if (specifier === "@/lib/supabase/client") {
    return { url: pathToFileURL(path.join(ICI, "clientStub.mjs")).href, shortCircuit: true };
  }
  if (specifier.startsWith("@/")) {
    const base = RACINE + specifier.slice(2);
    for (const extension of [".ts", ".tsx", "/index.ts"]) {
      if (existsSync(base + extension)) {
        return { url: pathToFileURL(base + extension).href, shortCircuit: true };
      }
    }
  }
  return suivant(specifier, contexte);
}
