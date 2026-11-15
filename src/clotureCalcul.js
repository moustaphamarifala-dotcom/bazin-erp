/* ============================================================
   Clôture de journée — calculs purs (aucune dépendance à React).
   Testés dans clotureCalcul.test.js : `npm test`.

   Principe : à la fermeture, on compare les espèces qui DEVRAIENT
   être dans la caisse (fond d'ouverture + espèces encaissées
   − sorties) aux espèces réellement comptées. La différence est
   l'écart de caisse.
   ============================================================ */

export const MODE_ESPECES = "Espèces";
export const MODE_INCONNU = "Mode non précisé";

const nbr = (x) => Number(x) || 0;
const jourDe = (s) => String(s || "").slice(0, 10);

export const venteTotal = (v) => nbr(v.metrage) * nbr(v.prixMetre) + nbr(v.transport);
export const venteReste = (v) => Math.max(0, venteTotal(v) - nbr(v.montantPaye));
export const ticketTotal = (t) =>
  (t.lignes || []).reduce((s, l) => s + nbr(l.quantite) * nbr(l.prixUnitaire), 0);

/* Une vente notée « Crédit » (ou sans mode) peut avoir reçu un acompte :
   on ne sait pas comment il a été payé, il est donc rangé à part. */
const modeVente = (v) => (!v.modePaiement || v.modePaiement === "Crédit" ? MODE_INCONNU : v.modePaiement);

/* Résumé d'une journée (AAAA-MM-JJ) à partir des listes déjà filtrées sur la boutique. */
export function resumeJour({ ventes = [], caisse = [], depenses = [], paiementsTeint = [] } = {}, jour) {
  const v = ventes.filter((x) => jourDe(x.date) === jour);
  const t = caisse.filter((x) => jourDe(x.dateTime) === jour);
  const d = depenses.filter((x) => jourDe(x.date) === jour);
  const p = paiementsTeint.filter((x) => jourDe(x.date) === jour);

  const modes = new Map();
  const ajouter = (mode, montant) => {
    if (montant > 0) modes.set(mode, (modes.get(mode) || 0) + montant);
  };
  v.forEach((x) => ajouter(modeVente(x), nbr(x.montantPaye)));
  t.forEach((x) => ajouter(x.mode || MODE_INCONNU, ticketTotal(x)));

  const totalVentes = v.reduce((s, x) => s + venteTotal(x), 0);
  const encaisseVentes = v.reduce((s, x) => s + nbr(x.montantPaye), 0);
  const creditAccorde = v.reduce((s, x) => s + venteReste(x), 0);
  const totalTickets = t.reduce((s, x) => s + ticketTotal(x), 0);
  const totalDepenses = d.reduce((s, x) => s + nbr(x.montant), 0);
  const teinturiers = p.reduce((s, x) => s + nbr(x.montant), 0);
  // Un paiement de teinturier sans mode est compté comme des espèces
  const teinturiersEspeces = p
    .filter((x) => !x.mode || x.mode === MODE_ESPECES)
    .reduce((s, x) => s + nbr(x.montant), 0);

  // Espèces d'abord, puis les autres modes du plus gros au plus petit
  const parMode = [...modes.entries()]
    .map(([mode, montant]) => ({ mode, montant }))
    .sort((a, b) => (a.mode === MODE_ESPECES ? -1 : b.mode === MODE_ESPECES ? 1 : b.montant - a.montant));

  return {
    jour,
    nbVentes: v.length,
    totalVentes,
    encaisseVentes,
    creditAccorde,
    nbTickets: t.length,
    totalTickets,
    chiffre: totalVentes + totalTickets,
    encaisse: encaisseVentes + totalTickets,
    parMode,
    especesEncaissees: modes.get(MODE_ESPECES) || 0,
    nbDepenses: d.length,
    depenses: totalDepenses,
    teinturiers,
    teinturiersEspeces,
  };
}

/* Espèces attendues dans la caisse.
   saisie : { fondOuverture, autresEntrees, versements, sortiesDeLaCaisse }
   - autresEntrees : espèces reçues hors ventes du jour (crédit remboursé, apport…)
   - versements    : espèces retirées avant de compter (remises au patron, déposées…)
   - sortiesDeLaCaisse : false si les dépenses du jour n'ont pas été payées avec cette caisse */
export function calculerCaisse(resume, saisie = {}) {
  const fond = nbr(saisie.fondOuverture);
  const autresEntrees = nbr(saisie.autresEntrees);
  const versements = nbr(saisie.versements);
  const sorties = saisie.sortiesDeLaCaisse === false ? 0 : resume.depenses + resume.teinturiersEspeces;
  const entrees = resume.especesEncaissees + autresEntrees;
  return { fond, entrees, sorties, versements, attendu: fond + entrees - sorties - versements };
}

export const ecartCaisse = (compte, attendu) => Math.round(nbr(compte) - nbr(attendu));

export function libelleEcart(ecart, fmt = (n) => String(n)) {
  if (!ecart) return "Caisse juste";
  return ecart > 0 ? `Excédent de ${fmt(ecart)}` : `Manque de ${fmt(-ecart)}`;
}

/* Fiche enregistrée pour une journée et une boutique. Les chiffres du jour sont
   copiés dans la fiche : elle reste lisible même si une vente est modifiée après. */
export function construireCloture({ id, jour, boutiqueId, resume, saisie = {}, par = "", creeLe = "" }) {
  const calc = calculerCaisse(resume, saisie);
  const comptees = nbr(saisie.especesComptees);
  return {
    id,
    date: jour,
    boutiqueId,
    creeLe,
    par,
    fondOuverture: calc.fond,
    autresEntrees: nbr(saisie.autresEntrees),
    versements: calc.versements,
    sortiesDeLaCaisse: saisie.sortiesDeLaCaisse !== false,
    especesComptees: comptees,
    attendu: calc.attendu,
    ecart: ecartCaisse(comptees, calc.attendu),
    note: String(saisie.note || "").trim(),
    resume: {
      nbVentes: resume.nbVentes,
      totalVentes: resume.totalVentes,
      nbTickets: resume.nbTickets,
      totalTickets: resume.totalTickets,
      chiffre: resume.chiffre,
      encaisse: resume.encaisse,
      creditAccorde: resume.creditAccorde,
      parMode: resume.parMode,
      especesEncaissees: resume.especesEncaissees,
      depenses: resume.depenses,
      teinturiersEspeces: resume.teinturiersEspeces,
      sorties: calc.sorties,
    },
  };
}

/* Les chiffres du jour ont-ils changé depuis l'enregistrement de la fiche ? */
export function clotureDepassee(cloture, resume) {
  if (!cloture || !cloture.resume) return false;
  const r = cloture.resume;
  return (
    Math.round(r.encaisse) !== Math.round(resume.encaisse) ||
    Math.round(r.especesEncaissees) !== Math.round(resume.especesEncaissees) ||
    Math.round(r.depenses) !== Math.round(resume.depenses) ||
    Math.round(r.teinturiersEspeces || 0) !== Math.round(resume.teinturiersEspeces)
  );
}

/* Fond d'ouverture proposé : ce qui est resté dans la caisse à la dernière clôture
   de la même boutique avant ce jour. */
export function fondSuggere(clotures = [], jour, boutiqueId, boutiqueDe = (c) => c.boutiqueId) {
  const avant = clotures
    .filter((c) => boutiqueDe(c) === boutiqueId && c.date < jour)
    .sort((a, b) => (a.date < b.date ? 1 : -1));
  return avant.length ? nbr(avant[0].especesComptees) : 0;
}

/* Somme des écarts d'une boutique sur les `jours` derniers jours (jour inclus). */
export function ecartCumule(clotures = [], jour, jours = 30) {
  const debut = new Date(jour + "T00:00:00Z");
  debut.setUTCDate(debut.getUTCDate() - (jours - 1));
  const min = debut.toISOString().slice(0, 10);
  return clotures.filter((c) => c.date >= min && c.date <= jour).reduce((s, c) => s + nbr(c.ecart), 0);
}

const jjmmaaaa = (iso) => {
  const [y, m, d] = jourDe(iso).split("-");
  return `${d}/${m}/${y}`;
};

/* Rapport en texte simple, à envoyer sur WhatsApp. */
export function texteCloture(c, boutique = "", fmt = (n) => String(n)) {
  const r = c.resume || {};
  const l = [`*Clôture du ${jjmmaaaa(c.date)}${boutique ? " — " + boutique : ""}*`];
  l.push(`Chiffre du jour : ${fmt(r.chiffre)}`);
  if (r.nbVentes) l.push(`Ventes : ${r.nbVentes} · ${fmt(r.totalVentes)}`);
  if (r.nbTickets) l.push(`Caisse : ${r.nbTickets} ticket(s) · ${fmt(r.totalTickets)}`);
  l.push(`Encaissé : ${fmt(r.encaisse)}`);
  (r.parMode || []).forEach((m) => l.push(`  • ${m.mode} : ${fmt(m.montant)}`));
  if (r.creditAccorde) l.push(`Crédit accordé : ${fmt(r.creditAccorde)}`);
  if (r.depenses) l.push(`Dépenses : ${fmt(r.depenses)}`);
  if (r.teinturiersEspeces) l.push(`Teinturiers (espèces) : ${fmt(r.teinturiersEspeces)}`);
  l.push("—");
  l.push(`Fond d'ouverture : ${fmt(c.fondOuverture)}`);
  if (c.autresEntrees) l.push(`Autres entrées : ${fmt(c.autresEntrees)}`);
  if (c.versements) l.push(`Versé / retiré : ${fmt(c.versements)}`);
  l.push(`Espèces attendues : ${fmt(c.attendu)}`);
  l.push(`Espèces comptées : ${fmt(c.especesComptees)}`);
  l.push(`Écart : ${libelleEcart(c.ecart, fmt)}`);
  if (c.par) l.push(`Clôturé par : ${c.par}`);
  if (c.note) l.push(`Note : ${c.note}`);
  return l.join("\n");
}
