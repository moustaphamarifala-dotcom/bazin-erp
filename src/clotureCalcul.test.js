import test from "node:test";
import assert from "node:assert/strict";
import {
  resumeJour, calculerCaisse, ecartCaisse, libelleEcart, construireCloture,
  clotureDepassee, fondSuggere, ecartCumule, texteCloture, MODE_ESPECES, MODE_INCONNU,
} from "./clotureCalcul.js";

const JOUR = "2026-11-15";
const donnees = () => ({
  ventes: [
    // payée en entier en espèces : 3 m × 5 000 + 1 000 de transport = 16 000
    { id: "v1", date: JOUR, metrage: 3, prixMetre: 5000, transport: 1000, montantPaye: 16000, modePaiement: "Espèces" },
    // à crédit avec acompte : 6 m × 5 000 = 30 000, 10 000 reçus, 20 000 restent dus
    { id: "v2", date: JOUR, metrage: 6, prixMetre: 5000, montantPaye: 10000, modePaiement: "Crédit" },
    // Orange Money
    { id: "v3", date: JOUR, metrage: "2", prixMetre: "7500", montantPaye: "15000", modePaiement: "Orange Money" },
    // un autre jour : ignorée
    { id: "v4", date: "2026-11-14", metrage: 10, prixMetre: 5000, montantPaye: 50000, modePaiement: "Espèces" },
  ],
  caisse: [
    { id: "t1", dateTime: JOUR + "T09:12:00.000Z", mode: "Espèces", lignes: [{ quantite: 2, prixUnitaire: 5000 }] },
    { id: "t2", dateTime: JOUR + "T16:40:00.000Z", mode: "Moov Money", lignes: [{ quantite: 1, prixUnitaire: 25000 }] },
    { id: "t3", dateTime: "2026-11-14T10:00:00.000Z", mode: "Espèces", lignes: [{ quantite: 1, prixUnitaire: 99999 }] },
  ],
  depenses: [
    { id: "d1", date: JOUR, montant: 2500 },
    { id: "d2", date: JOUR, montant: "1500" },
    { id: "d3", date: "2026-11-13", montant: 9000 },
  ],
  paiementsTeint: [
    { id: "p1", date: JOUR, montant: 5000, mode: "Espèces" },
    { id: "p2", date: JOUR, montant: 8000, mode: "Orange Money" },
    { id: "p3", date: JOUR, montant: 1000, mode: "" },
  ],
});

test("resumeJour : totaux du jour, crédit et répartition par mode", () => {
  const r = resumeJour(donnees(), JOUR);
  assert.equal(r.nbVentes, 3);
  assert.equal(r.totalVentes, 16000 + 30000 + 15000);
  assert.equal(r.encaisseVentes, 16000 + 10000 + 15000);
  assert.equal(r.creditAccorde, 20000);
  assert.equal(r.nbTickets, 2);
  assert.equal(r.totalTickets, 35000);
  assert.equal(r.chiffre, 96000);
  assert.equal(r.encaisse, 76000);
  assert.equal(r.especesEncaissees, 16000 + 10000);
  assert.equal(r.depenses, 4000);
  assert.equal(r.nbDepenses, 2);
  assert.equal(r.teinturiers, 14000);
  assert.equal(r.teinturiersEspeces, 6000);
  // Espèces en premier, puis du plus gros au plus petit
  assert.deepEqual(r.parMode, [
    { mode: MODE_ESPECES, montant: 26000 },
    { mode: "Moov Money", montant: 25000 },
    { mode: "Orange Money", montant: 15000 },
    { mode: MODE_INCONNU, montant: 10000 },
  ]);
  // La somme par mode retombe sur le total encaissé
  assert.equal(r.parMode.reduce((s, m) => s + m.montant, 0), r.encaisse);
});

test("resumeJour : journée vide et listes absentes", () => {
  const r = resumeJour({}, JOUR);
  assert.equal(r.chiffre, 0);
  assert.equal(r.encaisse, 0);
  assert.deepEqual(r.parMode, []);
  assert.equal(resumeJour(undefined, JOUR).depenses, 0);
});

test("calculerCaisse : fond + espèces + autres entrées − sorties − versements", () => {
  const r = resumeJour(donnees(), JOUR);
  const c = calculerCaisse(r, { fondOuverture: "10000", autresEntrees: 5000, versements: 20000 });
  assert.equal(c.entrees, 26000 + 5000);
  assert.equal(c.sorties, 4000 + 6000);
  assert.equal(c.attendu, 10000 + 31000 - 10000 - 20000);
});

test("calculerCaisse : dépenses payées hors caisse et champs vides", () => {
  const r = resumeJour(donnees(), JOUR);
  assert.equal(calculerCaisse(r, { sortiesDeLaCaisse: false }).attendu, 26000);
  assert.equal(calculerCaisse(r, { fondOuverture: "", autresEntrees: "", versements: "" }).attendu, 26000 - 10000);
  assert.equal(calculerCaisse(r).attendu, 16000);
});

test("ecartCaisse et libelleEcart", () => {
  assert.equal(ecartCaisse(16000, 16000), 0);
  assert.equal(ecartCaisse("15500", 16000), -500);
  assert.equal(ecartCaisse(16250, 16000), 250);
  const f = (n) => `${n} F`;
  assert.equal(libelleEcart(0, f), "Caisse juste");
  assert.equal(libelleEcart(-500, f), "Manque de 500 F");
  assert.equal(libelleEcart(250, f), "Excédent de 250 F");
});

test("construireCloture : fiche complète et figée", () => {
  const r = resumeJour(donnees(), JOUR);
  const c = construireCloture({
    id: "c1", jour: JOUR, boutiqueId: "principale", resume: r, par: "Awa", creeLe: "2026-11-15T19:00:00.000Z",
    saisie: { fondOuverture: 10000, especesComptees: "25500", note: "  RAS  " },
  });
  assert.equal(c.date, JOUR);
  assert.equal(c.attendu, 26000);
  assert.equal(c.especesComptees, 25500);
  assert.equal(c.ecart, -500);
  assert.equal(c.note, "RAS");
  assert.equal(c.sortiesDeLaCaisse, true);
  assert.equal(c.resume.sorties, 10000);
  assert.equal(c.resume.chiffre, 96000);
});

test("clotureDepassee : repère une vente ajoutée après la clôture", () => {
  const d = donnees();
  const r = resumeJour(d, JOUR);
  const c = construireCloture({ id: "c1", jour: JOUR, boutiqueId: "principale", resume: r, saisie: { especesComptees: 16000 } });
  assert.equal(clotureDepassee(c, r), false);
  d.ventes.push({ id: "v9", date: JOUR, metrage: 1, prixMetre: 5000, montantPaye: 5000, modePaiement: "Espèces" });
  assert.equal(clotureDepassee(c, resumeJour(d, JOUR)), true);
  assert.equal(clotureDepassee(null, r), false);
});

test("fondSuggere : espèces restées à la dernière clôture de la même boutique", () => {
  const clotures = [
    { date: "2026-11-12", boutiqueId: "principale", especesComptees: 7000 },
    { date: "2026-11-14", boutiqueId: "principale", especesComptees: 12000 },
    { date: "2026-11-14", boutiqueId: "b2", especesComptees: 99000 },
    { date: JOUR, boutiqueId: "principale", especesComptees: 1 },
  ];
  assert.equal(fondSuggere(clotures, JOUR, "principale"), 12000);
  assert.equal(fondSuggere(clotures, JOUR, "b2"), 99000);
  assert.equal(fondSuggere(clotures, "2026-11-12", "principale"), 0);
  assert.equal(fondSuggere([], JOUR, "principale"), 0);
});

test("ecartCumule : somme des écarts sur 30 jours", () => {
  const clotures = [
    { date: "2026-10-16", ecart: -1000 }, // 31e jour : hors fenêtre
    { date: "2026-10-17", ecart: -500 },
    { date: "2026-11-10", ecart: 200 },
    { date: JOUR, ecart: -300 },
    { date: "2026-11-16", ecart: -9999 }, // après le jour : ignoré
  ];
  assert.equal(ecartCumule(clotures, JOUR, 30), -600);
});

test("texteCloture : rapport WhatsApp lisible", () => {
  const r = resumeJour(donnees(), JOUR);
  const c = construireCloture({
    id: "c1", jour: JOUR, boutiqueId: "principale", resume: r, par: "Awa",
    saisie: { fondOuverture: 10000, versements: 5000, especesComptees: 21000 },
  });
  const t = texteCloture(c, "Boutique principale", (n) => `${n} F`);
  assert.match(t, /^\*Clôture du 15\/11\/2026 — Boutique principale\*/);
  assert.match(t, /Chiffre du jour : 96000 F/);
  assert.match(t, /• Espèces : 26000 F/);
  assert.match(t, /Crédit accordé : 20000 F/);
  assert.match(t, /Versé \/ retiré : 5000 F/);
  assert.match(t, /Espèces attendues : 21000 F/);
  assert.match(t, /Écart : Caisse juste/);
  assert.match(t, /Clôturé par : Awa/);
  assert.doesNotMatch(t, /Note :/);
});
