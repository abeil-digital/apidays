// Client Supabase injecté dans le moteur. LECTURE SEULE pour les tables de gel
// (`soldes_periode`, `acquisitions_gelees`) : le moteur y écrit quand il calcule une période
// close, ce que ce banc d'essai ne doit jamais faire dans la vraie base.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const RACINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const require = createRequire(path.join(RACINE, "package.json"));
const env = Object.fromEntries(
  fs
    .readFileSync(path.join(RACINE, ".env.local"), "utf8")
    .split("\n")
    .filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
    }),
);
export const ENVIRON = env;
export const supabaseJs = require("@supabase/supabase-js");

let client = null;
export function setClient(c) {
  client = c;
}

const TABLES_SANS_ECRITURE = new Set(["soldes_periode", "acquisitions_gelees"]);

export function createClient() {
  return new Proxy(client, {
    get(cible, propriete) {
      if (propriete === "from") {
        return (table) => {
          const constructeur = cible.from(table);
          if (!TABLES_SANS_ECRITURE.has(table)) return constructeur;
          return new Proxy(constructeur, {
            get(c, p) {
              if (p === "upsert" || p === "insert") return async () => ({ error: null });
              const v = c[p];
              return typeof v === "function" ? v.bind(c) : v;
            },
          });
        };
      }
      const v = cible[propriete];
      return typeof v === "function" ? v.bind(cible) : v;
    },
  });
}
