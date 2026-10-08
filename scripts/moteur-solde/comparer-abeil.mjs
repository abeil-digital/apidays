// Compare le moteur de solde (fetchSoldes) au calcul indépendant `oracle.mjs`, pour tous les
// collaborateurs avec solde d'Abeil, à plusieurs dates. Lecture seule. Voir README.md.
//   TEST_EMAIL=<email d'un manager/admin du tenant> DATES=2026-10-08,2027-06-15 \
//     node --import ./scripts/moteur-solde/register.mjs scripts/moteur-solde/comparer-abeil.mjs
import { oracle } from "./oracle.mjs";
const stub = await import("./clientStub.mjs");
const { createClient } = stub.supabaseJs;
const ENV = stub.ENVIRON;
const admin = createClient(ENV.NEXT_PUBLIC_SUPABASE_URL, ENV.SUPABASE_SERVICE_ROLE_KEY);
const EMAIL = process.env.TEST_EMAIL;
if (!EMAIL) throw new Error("TEST_EMAIL requis (manager/admin du tenant Abeil)");
const { data: link } = await admin.auth.admin.generateLink({ type: "magiclink", email: EMAIL });
const anon = createClient(ENV.NEXT_PUBLIC_SUPABASE_URL, ENV.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
  auth: { persistSession: false },
});
const { error } = await anon.auth.verifyOtp({
  email: EMAIL,
  token: link.properties.email_otp,
  type: "magiclink",
});
if (error) throw error;
stub.setClient(anon);
const sol = await import("@/lib/data/soldes.repository");

const { data: ent } = await admin.from("entreprises").select("id").eq("slug", "abeil").single();
const { data: types } = await admin.from("types_absences").select("id,code");
const code = (id) => types.find((t) => t.id === id)?.code;
const { data: users } = await admin
  .from("utilisateurs")
  .select("id,prenom,nom,date_entree,anciennete_date_reference,sans_solde,statut")
  .eq("entreprise_id", ent.id)
  .eq("statut", "actif")
  .eq("sans_solde", false);
const { data: inits } = await admin.from("soldes_initiaux").select("*").eq("entreprise_id", ent.id);
const { data: dem } = await admin.from("demandes_conges").select("*").eq("entreprise_id", ent.id);
const { data: decs } = await admin
  .from("decisions_demande")
  .select("demande_id,statut,decide_le")
  .eq("entreprise_id", ent.id);
const { data: adjs } = await admin
  .from("ajustements_solde")
  .select("*")
  .eq("entreprise_id", ent.id);
const { data: ra } = await admin.from("regles_acquisition").select("*").eq("entreprise_id", ent.id);
const { data: bon } = await admin.from("regles_anciennete").select("*").eq("entreprise_id", ent.id);
const regles = Object.fromEntries(
  ra.map((r) => [code(r.type_absence_id), { taux: Number(r.taux_acquisition_mensuel) }]),
);
const dates = (process.env.DATES || "2026-10-08").split(",");
const f = (x) => (Math.round(x * 100) / 100).toFixed(2).padStart(7);
let ecarts = 0;
for (const D of dates) {
  console.log(`\n=== Date de calcul : ${D}`);
  console.log("Collaborateur".padEnd(22), "  type   moteur  oracle   écart");
  for (const u of users) {
    const initial = inits.find((i) => i.utilisateur_id === u.id);
    const d = dem
      .filter((r) => r.utilisateur_id === u.id)
      .map((r) => ({
        ...r,
        cp: code(r.type_absence_id) === "CP",
        rtt: code(r.type_absence_id) === "RTT",
      }));
    const o = oracle({
      user: { ancRef: u.anciennete_date_reference ?? u.date_entree },
      initial,
      demandes: d,
      decisions: decs,
      ajustements: adjs
        .filter((a) => a.utilisateur_id === u.id)
        .map((a) => ({ ...a, type: code(a.type_absence_id) })),
      regles,
      bonusRegles: bon,
      D,
    });
    const m = await sol.fetchSoldes(u.id, new Date(D + "T00:00:00Z"));
    for (const [k, mv] of [
      ["cp", m.cp.valeurApresAttente],
      ["cpa", m.cpa.valeurApresAttente],
      ["rtt", m.rtt.valeurApresAttente],
    ]) {
      const ecart = mv - o[k];
      if (Math.abs(ecart) > 0.005) {
        ecarts++;
        console.log(
          `${u.prenom} ${u.nom}`.padEnd(22),
          k.toUpperCase().padEnd(5),
          f(mv),
          f(o[k]),
          f(ecart),
          k === "cp" ? " ← bonus oracle: " + JSON.stringify(o.detail.bonus) : "",
        );
      }
    }
  }
}
console.log(
  `\n${ecarts} écart(s) au total sur ${users.length} collaborateurs × ${dates.length} dates × 3 types.`,
);
process.exit(0);
