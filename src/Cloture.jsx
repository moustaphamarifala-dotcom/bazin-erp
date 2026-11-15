import React, { useMemo, useState } from "react";
import {
  resumeJour, calculerCaisse, ecartCaisse, libelleEcart, construireCloture,
  clotureDepassee, fondSuggere, ecartCumule, texteCloture,
} from "./clotureCalcul.js";
import { BOUTIQUE_PRINCIPALE, TOUTES, boutiqueDe, nomBoutique, estPatron } from "./Gestion.jsx";

/* ============================================================
   Clôture de journée : à la fermeture, on compte la caisse et on
   compare aux chiffres saisis dans la journée. Une fiche par jour
   et par boutique, avec un rapport à envoyer sur WhatsApp.
   Les calculs sont dans clotureCalcul.js (testés).
   ============================================================ */

const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const nbr = (x) => Number(x) || 0;
const fcfa = (n) => nbr(n).toLocaleString("fr-FR", { style: "currency", currency: "XOF", maximumFractionDigits: 0 });
const today = () => new Date().toISOString().slice(0, 10);
const fmtDate = (iso) => {
  if (!iso) return "";
  const [y, m, d] = String(iso).slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
};
const inputCls =
  "border border-[#D8D2C2] bg-[#FBF9F4] rounded-sm px-3 py-2 text-[#1B2430] focus:outline-none focus:ring-2 focus:ring-[#1F6F5C] focus:border-[#1F6F5C]";
const btnVert = "bz-sans bg-[#1F6F5C] text-white px-4 py-2 rounded-sm text-sm font-medium hover:bg-[#195A4A] disabled:opacity-40";
const btnBord = "bz-sans px-4 py-2 rounded-sm text-sm border border-[#D8D2C2] hover:bg-white disabled:opacity-40";
const carte = "bg-white border border-[#D8D2C2] rounded-sm p-5 mb-5";
const couleurEcart = (e) => (!e ? "#1F6F5C" : e < 0 ? "#B23A2E" : "#B9832F");

const envoyerWhatsApp = (texte) =>
  window.open(`https://wa.me/?text=${encodeURIComponent(texte)}`, "_blank");

function Ligne({ label, valeur, fort, signe = "" }) {
  return (
    <div className={`flex justify-between gap-3 py-1.5 ${fort ? "border-t border-[#D8D2C2] mt-1 pt-2 font-semibold" : ""}`}>
      <span className="bz-sans text-sm text-[#5B5F55]">{label}</span>
      <span className="bz-mono text-sm whitespace-nowrap">{signe}{fcfa(valeur)}</span>
    </div>
  );
}

function Champ({ label, aide, value, onChange, disabled }) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="text-[#5B5F55] font-medium bz-sans">{label}</span>
      <input type="number" inputMode="numeric" min="0" step="any" disabled={disabled}
        className={inputCls + " bz-mono"} value={value} onChange={(e) => onChange(e.target.value)} placeholder="0" />
      {aide && <span className="bz-sans text-[12px] text-[#7A7F74]">{aide}</span>}
    </label>
  );
}

/* Formulaire d'une journée : remonté à chaque changement de jour, de boutique ou de fiche */
function FormulaireCloture({ jour, resume, existante, fondPropose, onEnregistrer, nomDeLaBoutique }) {
  const [saisie, setSaisie] = useState(() =>
    existante
      ? {
          fondOuverture: String(existante.fondOuverture ?? ""),
          autresEntrees: existante.autresEntrees ? String(existante.autresEntrees) : "",
          versements: existante.versements ? String(existante.versements) : "",
          sortiesDeLaCaisse: existante.sortiesDeLaCaisse !== false,
          especesComptees: String(existante.especesComptees ?? ""),
          note: existante.note || "",
        }
      : { fondOuverture: fondPropose ? String(fondPropose) : "", autresEntrees: "", versements: "", sortiesDeLaCaisse: true, especesComptees: "", note: "" }
  );
  const [erreur, setErreur] = useState("");
  const maj = (patch) => { setSaisie((s) => ({ ...s, ...patch })); setErreur(""); };

  const calc = calculerCaisse(resume, saisie);
  const compte = saisie.especesComptees !== "";
  const ecart = compte ? ecartCaisse(saisie.especesComptees, calc.attendu) : null;
  const sortiesDuJour = resume.depenses + resume.teinturiersEspeces;

  const enregistrer = (e) => {
    e.preventDefault();
    if (!compte) { setErreur("Comptez les espèces de la caisse et saisissez le montant."); return; }
    if (nbr(saisie.especesComptees) < 0) { setErreur("Le montant compté ne peut pas être négatif."); return; }
    onEnregistrer(saisie);
  };

  return (
    <form onSubmit={enregistrer} className={carte}>
      <h2 className="bz-serif text-xl font-semibold mb-1">Compter la caisse</h2>
      <p className="bz-sans text-sm text-[#5B5F55] mb-4">
        Espèces seulement. L'argent reçu par Orange Money, Moov Money ou Wave n'est pas dans la caisse.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
        <Champ label="Fond d'ouverture" value={saisie.fondOuverture} onChange={(v) => maj({ fondOuverture: v })}
          aide={!existante && fondPropose ? "Repris de la dernière clôture." : "Espèces dans la caisse ce matin."} />
        <Champ label="Autres entrées d'espèces" value={saisie.autresEntrees} onChange={(v) => maj({ autresEntrees: v })}
          aide="Crédit remboursé aujourd'hui, apport…" />
        <Champ label="Versé ou retiré" value={saisie.versements} onChange={(v) => maj({ versements: v })}
          aide="Remis au patron ou déposé avant de compter." />
      </div>

      {sortiesDuJour > 0 && (
        <label className="flex items-start gap-2 mb-4 bz-sans text-sm text-[#1B2430]">
          <input type="checkbox" className="mt-1" checked={saisie.sortiesDeLaCaisse}
            onChange={(e) => maj({ sortiesDeLaCaisse: e.target.checked })} />
          <span>Les dépenses du jour ({fcfa(sortiesDuJour)}) ont été payées avec cette caisse.</span>
        </label>
      )}

      <div className="bg-[#FBF9F4] border border-[#D8D2C2] rounded-sm p-4 mb-4">
        <Ligne label="Fond d'ouverture" valeur={calc.fond} />
        <Ligne label="Espèces encaissées (ventes et tickets)" valeur={resume.especesEncaissees} signe="+ " />
        {nbr(saisie.autresEntrees) > 0 && <Ligne label="Autres entrées" valeur={nbr(saisie.autresEntrees)} signe="+ " />}
        {calc.sorties > 0 && <Ligne label="Dépenses payées avec la caisse" valeur={calc.sorties} signe="− " />}
        {calc.versements > 0 && <Ligne label="Versé ou retiré" valeur={calc.versements} signe="− " />}
        <Ligne label="Espèces attendues dans la caisse" valeur={calc.attendu} fort />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-start mb-4">
        <Champ label="Espèces comptées dans la caisse" value={saisie.especesComptees} onChange={(v) => maj({ especesComptees: v })}
          aide="Ce montant devient le fond d'ouverture proposé demain." />
        <div className="border rounded-sm p-4" style={{ borderColor: compte ? couleurEcart(ecart) : "#D8D2C2" }} data-test="ecart">
          <div className="bz-sans text-[12px] uppercase tracking-widest text-[#5B5F55]">Écart de caisse</div>
          <div className="bz-serif text-2xl font-semibold" style={{ color: compte ? couleurEcart(ecart) : "#9AA0A6" }}>
            {compte ? libelleEcart(ecart, fcfa) : "—"}
          </div>
        </div>
      </div>

      <label className="flex flex-col gap-1 text-sm mb-4">
        <span className="text-[#5B5F55] font-medium bz-sans">Note (facultatif)</span>
        <input className={inputCls} value={saisie.note} onChange={(e) => maj({ note: e.target.value })}
          placeholder="Explication d'un écart, événement du jour…" />
      </label>

      {erreur && (
        <div className="mb-4 px-4 py-3 rounded-sm bz-sans text-sm border bg-[#F3E2D2] border-[#C1652F] text-[#8A3F14]">{erreur}</div>
      )}
      <button type="submit" className={btnVert}>
        {existante ? "Mettre à jour la clôture" : `Clôturer le ${fmtDate(jour)}`}{nomDeLaBoutique ? ` — ${nomDeLaBoutique}` : ""}
      </button>
    </form>
  );
}

export function ClotureView({
  ventes, caisse, depenses, paiementsTeint = [], clotures, saveClotures,
  boutiques, boutiqueActive, multiBoutiques, utilisateur,
}) {
  const [jour, setJour] = useState(today());
  const [message, setMessage] = useState(null);

  // Avec plusieurs boutiques, on clôture une boutique à la fois
  const aChoisir = multiBoutiques && boutiqueActive === TOUTES;
  const boutiqueId = boutiqueActive === TOUTES ? BOUTIQUE_PRINCIPALE : boutiqueActive;
  const nomDeLaBoutique = multiBoutiques ? nomBoutique(boutiques, boutiqueId) : "";
  const peutSupprimer = !utilisateur || estPatron(utilisateur);

  const resume = useMemo(
    () => resumeJour({ ventes, caisse, depenses, paiementsTeint }, jour),
    [ventes, caisse, depenses, paiementsTeint, jour]
  );
  const deLaBoutique = aChoisir ? clotures : clotures.filter((c) => boutiqueDe(c) === boutiqueId);
  const existante = aChoisir ? null : deLaBoutique.find((c) => c.date === jour) || null;
  const historique = [...deLaBoutique].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0)).slice(0, 31);
  const cumul = ecartCumule(deLaBoutique, today(), 30);
  const nbCumul = deLaBoutique.filter((c) => c.date <= today()).length;

  const enregistrer = (saisie) => {
    const fiche = construireCloture({
      id: existante ? existante.id : uid(),
      jour, boutiqueId, resume, saisie,
      par: utilisateur ? utilisateur.nom : (existante && existante.par) || "",
      creeLe: new Date().toISOString(),
    });
    saveClotures(existante ? clotures.map((c) => (c.id === existante.id ? fiche : c)) : [...clotures, fiche]);
    setMessage({ ton: "ok", texte: `Journée du ${fmtDate(jour)} clôturée. ${libelleEcart(fiche.ecart, fcfa)}.` });
  };
  const supprimer = (c) => {
    if (!window.confirm(`Supprimer la clôture du ${fmtDate(c.date)} ?`)) return;
    saveClotures(clotures.filter((x) => x.id !== c.id));
    setMessage({ ton: "ok", texte: "Clôture supprimée." });
  };
  const rapport = (c) => texteCloture(c, multiBoutiques ? nomBoutique(boutiques, boutiqueDe(c)) : "", fcfa);

  return (
    <div className="max-w-4xl">
      <div className="flex flex-wrap items-end justify-between gap-3 mb-6">
        <div>
          <h1 className="bz-serif text-3xl font-semibold">Clôture de journée</h1>
          <p className="bz-sans text-[#5B5F55]">
            Le soir, comptez la caisse : l'application dit s'il manque de l'argent.
          </p>
        </div>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-[#5B5F55] font-medium bz-sans">Journée</span>
          <input type="date" className={inputCls} value={jour} max={today()}
            onChange={(e) => { setJour(e.target.value || today()); setMessage(null); }} />
        </label>
      </div>

      {message && (
        <div className={`mb-5 px-4 py-3 rounded-sm bz-sans text-sm border ${
          message.ton === "ok" ? "bg-[#E4F1EC] border-[#1F6F5C] text-[#17493D]" : "bg-[#F3E2D2] border-[#C1652F] text-[#8A3F14]"
        }`}>{message.texte}</div>
      )}

      {aChoisir ? (
        <div className={carte}>
          <p className="bz-sans text-sm">
            Choisissez une boutique dans le menu pour clôturer sa journée. L'historique ci-dessous montre les clôtures de toutes les boutiques.
          </p>
        </div>
      ) : (
        <>
          {/* ---------- Chiffres du jour ---------- */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
            {[
              ["Chiffre du jour", resume.chiffre, `${resume.nbVentes} vente(s) · ${resume.nbTickets} ticket(s)`],
              ["Encaissé", resume.encaisse, "tous modes de paiement"],
              ["Crédit accordé", resume.creditAccorde, "reste à payer sur les ventes du jour"],
              ["Dépenses", resume.depenses + resume.teinturiers, `${resume.nbDepenses} dépense(s)${resume.teinturiers ? " + teinturiers" : ""}`],
            ].map(([label, valeur, detail]) => (
              <div key={label} className="bg-white border border-[#D8D2C2] rounded-sm p-4">
                <div className="bz-sans text-[11px] uppercase tracking-widest text-[#5B5F55]">{label}</div>
                <div className="bz-mono text-lg font-semibold mt-1">{fcfa(valeur)}</div>
                <div className="bz-sans text-[12px] text-[#7A7F74] mt-0.5">{detail}</div>
              </div>
            ))}
          </div>

          <div className={carte}>
            <h2 className="bz-serif text-xl font-semibold mb-2">Encaissé par mode de paiement</h2>
            {resume.parMode.length === 0 ? (
              <p className="bz-sans text-sm text-[#5B5F55]">Aucun encaissement saisi pour le {fmtDate(jour)}.</p>
            ) : (
              <>
                {resume.parMode.map((m) => <Ligne key={m.mode} label={m.mode} valeur={m.montant} />)}
                <Ligne label="Total encaissé" valeur={resume.encaisse} fort />
              </>
            )}
            <p className="bz-sans text-[12px] text-[#7A7F74] mt-3">
              Un crédit remboursé un autre jour reste compté au jour de la vente : saisissez-le dans « Autres entrées d'espèces ».
            </p>
          </div>

          {existante && clotureDepassee(existante, resume) && (
            <div className="mb-5 px-4 py-3 rounded-sm bz-sans text-sm border bg-[#F3E2D2] border-[#C1652F] text-[#8A3F14]">
              Les chiffres du {fmtDate(jour)} ont changé depuis la clôture (encaissé : {fcfa(existante.resume.encaisse)} → {fcfa(resume.encaisse)}).
              Vérifiez puis mettez la clôture à jour.
            </div>
          )}
          {existante && (
            <div className="mb-5 flex flex-wrap items-center gap-3 bz-sans text-sm">
              <span className="inline-block border-2 border-[#1F6F5C] text-[#1F6F5C] rounded-full px-3 py-0.5 text-[11px] tracking-widest uppercase font-semibold">Clôturée</span>
              <span className="text-[#5B5F55]">
                {existante.par ? `par ${existante.par} · ` : ""}{libelleEcart(existante.ecart, fcfa)}
              </span>
              <button type="button" className={btnBord} onClick={() => envoyerWhatsApp(rapport(existante))}>
                Envoyer le rapport sur WhatsApp
              </button>
            </div>
          )}

          <FormulaireCloture
            key={`${jour}|${boutiqueId}|${existante ? existante.creeLe : "nouvelle"}`}
            jour={jour} resume={resume} existante={existante} nomDeLaBoutique={nomDeLaBoutique}
            fondPropose={fondSuggere(clotures, jour, boutiqueId, boutiqueDe)}
            onEnregistrer={enregistrer}
          />
        </>
      )}

      {/* ---------- Historique ---------- */}
      <div className={carte}>
        <div className="flex flex-wrap items-baseline justify-between gap-2 mb-3">
          <h2 className="bz-serif text-xl font-semibold">Dernières clôtures</h2>
          {nbCumul > 0 && (
            <span className="bz-sans text-sm text-[#5B5F55]">
              Écarts cumulés sur 30 jours :{" "}
              <span className="bz-mono font-semibold" style={{ color: couleurEcart(cumul) }}>{libelleEcart(cumul, fcfa)}</span>
            </span>
          )}
        </div>
        {historique.length === 0 ? (
          <p className="bz-sans text-sm text-[#5B5F55]">Aucune journée clôturée pour l'instant.</p>
        ) : (
          <div className="flex flex-col divide-y divide-[#E6E1D4]">
            {historique.map((c) => (
              <div key={c.id} className="py-3 flex flex-wrap items-center justify-between gap-3">
                <button type="button" className="text-left" onClick={() => { setJour(c.date); setMessage(null); window.scrollTo?.(0, 0); }}>
                  <div className="bz-sans text-sm font-semibold underline decoration-[#D8D2C2]">
                    {fmtDate(c.date)}{multiBoutiques ? ` · ${nomBoutique(boutiques, boutiqueDe(c))}` : ""}
                  </div>
                  <div className="bz-sans text-[12px] text-[#5B5F55]">
                    Chiffre {fcfa(c.resume ? c.resume.chiffre : 0)} · attendu {fcfa(c.attendu)} · compté {fcfa(c.especesComptees)}
                    {c.par ? ` · ${c.par}` : ""}
                  </div>
                </button>
                <div className="flex items-center gap-2">
                  <span className="bz-mono text-sm font-semibold" style={{ color: couleurEcart(c.ecart) }}>{libelleEcart(c.ecart, fcfa)}</span>
                  <button type="button" className={btnBord} onClick={() => envoyerWhatsApp(rapport(c))}>WhatsApp</button>
                  {peutSupprimer && (
                    <button type="button" className="bz-sans text-sm text-[#B23A2E] underline" onClick={() => supprimer(c)}>Supprimer</button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
