// Calcul INDÉPENDANT du moteur de solde, écrit à partir des règles métier (pas du code du moteur),
// pour les collaborateurs d'Abeil (période CP du 01/06, période RTT = année civile, solde initial au 01/06/2026).
// Théorique = capital − congés validés ou en attente (statuts tels que résolus à la date D).
export function oracle({
  user,
  initial,
  demandes,
  decisions,
  ajustements,
  regles,
  bonusRegles,
  D,
}) {
  const dD = new Date(D + "T00:00:00Z");
  const ref = initial.date_reference;
  const finJour = D + "T23:59:59.999Z";
  const statutA = (r) => {
    const dec = decisions
      .filter((x) => x.demande_id === r.id && x.decide_le <= finJour)
      .sort((a, b) => b.decide_le.localeCompare(a.decide_le))[0];
    return dec
      ? dec.statut
      : r.date_decision && r.date_decision <= finJour
        ? r.statut
        : "en_attente";
  };
  const jours = (r) => Number(r.nb_demi_journees) / 2;
  const somme = (pred) =>
    demandes
      .filter((r) => pred(r) && ["validee", "en_attente"].includes(statutA(r)))
      .reduce((s, r) => s + jours(r), 0);
  // Périodes CP : 01/06 → 31/05
  const an = dD.getUTCFullYear();
  const debP = dD.getUTCMonth() >= 5 ? an : an - 1;
  const P = { debut: `${debP}-06-01`, fin: `${debP + 1}-05-31` };
  const Pprec = { debut: `${debP - 1}-06-01`, fin: `${debP}-05-31` };
  const ansA = (a) => {
    const d0 = new Date(user.ancRef + "T00:00:00Z");
    const d1 = new Date(a + "T00:00:00Z");
    let y = d1.getUTCFullYear() - d0.getUTCFullYear();
    if (
      d1.getUTCMonth() < d0.getUTCMonth() ||
      (d1.getUTCMonth() === d0.getUTCMonth() && d1.getUTCDate() < d0.getUTCDate())
    )
      y--;
    return y;
  };
  const bonusA = (ans) =>
    Math.max(
      0,
      ...bonusRegles.filter((r) => ans >= r.seuil_annees).map((r) => r.jours_supplementaires),
    );
  // Anniversaires dans [debut, fin] au-delà de `apres` (exclu) et jusqu'à `jusqu`
  const bonusEvents = (debut, fin, apres, jusqu) => {
    const out = [];
    for (let y = Number(debut.slice(0, 4)); y <= Number(fin.slice(0, 4)); y++) {
      const a = `${y}-${user.ancRef.slice(5)}`;
      if (a >= debut && a <= fin && a > apres && a <= jusqu)
        out.push({ date: a, jours: bonusA(ansA(a)) });
    }
    return out.filter((e) => e.jours > 0);
  };
  const moisComplets = (debut, jusqu) => {
    // mois dont le 1er du mois suivant est atteint
    const d0 = new Date(debut + "T00:00:00Z"),
      d1 = new Date(jusqu + "T00:00:00Z");
    let m =
      (d1.getUTCFullYear() - d0.getUTCFullYear()) * 12 + (d1.getUTCMonth() - d0.getUTCMonth());
    if (d1.getUTCDate() < d0.getUTCDate()) m--;
    return Math.max(0, Math.min(12, m));
  };
  const tCP = regles.CP.taux,
    tRTT = regles.RTT.taux;
  const adj = (type, anticip, debut, fin) =>
    ajustements
      .filter(
        (a) =>
          a.type === type &&
          a.is_anticipation === anticip &&
          a.created_at >= debut &&
          a.created_at <= fin + "T23:59:59.999Z",
      )
      .reduce((s, a) => s + Number(a.delta_jours), 0);

  let capitalP,
    fenetreDebut = P.debut;
  if (ref >= Pprec.fin && ref <= P.fin && ref >= Pprec.fin) {
    // P gouvernée par le solde initial si la période précédente se termine avant/à la référence
  }
  const initialGouverne = Pprec.fin <= ref;
  let cp;
  if (initialGouverne) {
    const ev = bonusEvents(P.debut, P.fin, ref, D);
    capitalP = initial.cp + ev.reduce((s, e) => s + e.jours, 0);
    fenetreDebut = ref > P.debut ? ref : P.debut;
  } else {
    // bascule : report + transfert CPA + bonus
    const evPrev = bonusEvents(Pprec.debut, Pprec.fin, ref, Pprec.fin);
    const capPrev = initial.cp + evPrev.reduce((s, e) => s + e.jours, 0);
    const consPrev = somme(
      (r) =>
        r.cp &&
        !r.is_anticipation &&
        r.date_debut >= (ref > Pprec.debut ? ref : Pprec.debut) &&
        r.date_debut <= Pprec.fin,
    );
    const report = Math.max(0, capPrev - consPrev);
    const debCpaPrev = ref >= Pprec.debut && ref <= Pprec.fin ? ref : Pprec.debut;
    const baseCpaPrev = ref >= Pprec.debut && ref <= Pprec.fin ? initial.cpa : 0;
    const accrualPrev = baseCpaPrev + tCP * moisComplets(debCpaPrev, P.debut);
    const consCpaPrev = somme(
      (r) => r.cp && r.is_anticipation && r.date_debut >= debCpaPrev && r.date_debut <= Pprec.fin,
    );
    const transfert = Math.max(0, accrualPrev - consCpaPrev);
    const ev = bonusEvents(P.debut, P.fin, "0000-00-00", D);
    capitalP = report + transfert + ev.reduce((s, e) => s + e.jours, 0);
  }
  const consCP = somme(
    (r) => r.cp && !r.is_anticipation && r.date_debut >= fenetreDebut && r.date_debut <= P.fin,
  );
  cp = capitalP - consCP + adj("CP", false, fenetreDebut, P.fin);

  // CPA
  const refDansP = ref >= P.debut && ref <= P.fin;
  const debCpa = refDansP ? ref : P.debut,
    baseCpa = refDansP ? initial.cpa : 0;
  const accCpa = baseCpa + tCP * moisComplets(debCpa, D);
  const finPlus50 = `${Number(P.fin.slice(0, 4)) + 50}-05-31`;
  const consCpa =
    somme((r) => r.cp && r.is_anticipation && r.date_debut >= debCpa && r.date_debut <= finPlus50) +
    somme((r) => r.cp && !r.is_anticipation && r.date_debut > P.fin && r.date_debut <= finPlus50);
  const cpa = accCpa - consCpa + adj("CP", true, P.debut, P.fin);

  // RTT : année civile
  const R = { debut: `${an}-01-01`, fin: `${an}-12-31` };
  const refDansR = ref >= R.debut && ref <= R.fin;
  const debR = refDansR ? ref : R.debut,
    baseR = refDansR ? initial.rtt : 0;
  const accR = baseR + tRTT * moisComplets(debR, D);
  const consR = somme((r) => r.rtt && r.date_debut >= debR && r.date_debut <= R.fin);
  const rtt = accR - consR + adj("RTT", false, debR, R.fin);
  return {
    cp,
    cpa,
    rtt,
    detail: {
      capitalP,
      consCP,
      accCpa,
      consCpa,
      accR,
      consR,
      bonus: initialGouverne
        ? bonusEvents(P.debut, P.fin, ref, D)
        : bonusEvents(P.debut, P.fin, "0000-00-00", D),
    },
  };
}
