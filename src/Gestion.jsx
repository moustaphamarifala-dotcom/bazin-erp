import React, { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import JsBarcode from "jsbarcode";

/* ============================================================
   Gestion multi-boutiques de Bazin :
   - boutiques et transferts
   - entrées de stock, inventaire, historique des mouvements
   - codes-barres (étiquettes, recherche et vente par code)
   - utilisateurs, code PIN et écrans autorisés
   ============================================================ */

/* ---------- Utilitaires ---------- */
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const nbr = (x) => Number(x) || 0;
const fcfa = (n) => nbr(n).toLocaleString("fr-FR", { style: "currency", currency: "XOF", maximumFractionDigits: 0 });
const today = () => new Date().toISOString().slice(0, 10);
const fmtDate = (iso) => {
  if (!iso) return "";
  const [y, m, d] = String(iso).slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
};
const norm = (s) => String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").trim().toLowerCase();
const inputCls =
  "border border-[#D8D2C2] bg-[#FBF9F4] rounded-sm px-3 py-2 text-[#1B2430] focus:outline-none focus:ring-2 focus:ring-[#1F6F5C] focus:border-[#1F6F5C]";
const btnVert = "bz-sans bg-[#1F6F5C] text-white px-4 py-2 rounded-sm text-sm font-medium hover:bg-[#195A4A] disabled:opacity-40";
const btnNoir = "bz-sans bg-[#1B2430] text-white px-4 py-2 rounded-sm text-sm font-medium disabled:opacity-40";
const btnBord = "bz-sans px-4 py-2 rounded-sm text-sm border border-[#D8D2C2] hover:bg-white";
const carte = "bg-white border border-[#D8D2C2] rounded-sm p-5 mb-5";

function Field({ label, children, className = "" }) {
  return (
    <label className={`flex flex-col gap-1 text-sm ${className}`}>
      <span className="text-[#5B5F55] font-medium bz-sans">{label}</span>
      {children}
    </label>
  );
}
function Message({ m }) {
  if (!m) return null;
  return (
    <div className={`mb-5 px-4 py-3 rounded-sm bz-sans text-sm border ${
      m.ton === "ok" ? "bg-[#E4F1EC] border-[#1F6F5C] text-[#17493D]" : "bg-[#F3E2D2] border-[#C1652F] text-[#8A3F14]"
    }`}>{m.texte}</div>
  );
}
function exportCSV(filename, rows, headers) {
  const escape = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const csv = [headers.map((h) => h.label).join(";"), ...rows.map((r) => headers.map((h) => escape(r[h.key])).join(";"))].join("\n");
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/* ============================================================
   Boutiques
   ============================================================ */
export const BOUTIQUE_PRINCIPALE = "principale";
export const TOUTES = "toutes";
/* Un enregistrement sans boutique (saisi avant les boutiques) appartient à la boutique principale */
export const boutiqueDe = (x) => (x && x.boutiqueId) || BOUTIQUE_PRINCIPALE;
export const listeBoutiques = (boutiques) => {
  const l = Array.isArray(boutiques) ? boutiques.filter((b) => b && b.id) : [];
  return l.some((b) => b.id === BOUTIQUE_PRINCIPALE)
    ? l
    : [{ id: BOUTIQUE_PRINCIPALE, nom: "Boutique principale", adresse: "", telephone: "" }, ...l];
};
export const nomBoutique = (boutiques, id) =>
  listeBoutiques(boutiques).find((b) => b.id === (id || BOUTIQUE_PRINCIPALE))?.nom || "Boutique supprimée";

/* Remet dans la liste complète les éléments modifiés d'une vue filtrée, sans changer
   la place des autres : les éléments de la vue sont remplacés dans l'ordre, les nouveaux
   vont à la fin. */
export function fusionnerVue(complet, vueSuivante, dansVue) {
  const file = [...vueSuivante];
  const res = [];
  for (const x of complet) {
    if (dansVue(x)) { if (file.length) res.push(file.shift()); } else res.push(x);
  }
  return [...res, ...file];
}

const venteTotal = (v) => nbr(v.metrage) * nbr(v.prixMetre) + nbr(v.transport);
const ticketTotal = (t) => (t.lignes || []).reduce((s, l) => s + nbr(l.quantite) * nbr(l.prixUnitaire), 0);

export function BoutiquesView({ boutiques, saveBoutiques, stock, ventes, caisse, depenses, boutiqueActive, choisirBoutique }) {
  const liste = listeBoutiques(boutiques);
  const vide = { id: "", nom: "", adresse: "", telephone: "" };
  const [edition, setEdition] = useState(null);
  const [message, setMessage] = useState(null);
  const mois = today().slice(0, 7);

  const chiffres = (id) => {
    const de = (l) => l.filter((x) => boutiqueDe(x) === id);
    const duMois = (l, champ) => de(l).filter((x) => String(x[champ] || "").slice(0, 7) === mois);
    const s = de(stock);
    return {
      articles: s.length,
      valeur: s.reduce((t, x) => t + nbr(x.quantite) * nbr(x.prixUnitaire), 0),
      ventes: duMois(ventes, "date").reduce((t, v) => t + venteTotal(v), 0) + duMois(caisse, "dateTime").reduce((t, x) => t + ticketTotal(x), 0),
      depenses: duMois(depenses, "date").reduce((t, d) => t + nbr(d.montant), 0),
    };
  };
  const utilisee = (id) => [stock, ventes, caisse, depenses].some((l) => l.some((x) => boutiqueDe(x) === id));

  const enregistrer = (e) => {
    e.preventDefault();
    const nom = edition.nom.trim();
    if (!nom) return;
    if (liste.some((b) => b.id !== edition.id && norm(b.nom) === norm(nom))) {
      setMessage({ ton: "erreur", texte: "Une boutique porte déjà ce nom." });
      return;
    }
    const fiche = { ...edition, nom, id: edition.id || uid() };
    const existe = liste.some((b) => b.id === fiche.id);
    saveBoutiques(existe ? liste.map((b) => (b.id === fiche.id ? fiche : b)) : [...liste, fiche]);
    setEdition(null);
    setMessage({ ton: "ok", texte: existe ? "Boutique modifiée." : `Boutique « ${nom} » créée. Choisissez-la dans le menu pour y travailler.` });
  };
  const supprimer = (b) => {
    if (utilisee(b.id)) {
      setMessage({ ton: "erreur", texte: `« ${b.nom} » contient encore du stock, des ventes ou des dépenses. Transférez ou supprimez-les d'abord.` });
      return;
    }
    saveBoutiques(liste.filter((x) => x.id !== b.id));
    if (boutiqueActive === b.id) choisirBoutique(TOUTES);
    setMessage({ ton: "ok", texte: "Boutique supprimée." });
  };

  return (
    <div className="max-w-4xl">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="bz-serif text-3xl font-semibold">Boutiques</h1>
          <p className="bz-sans text-[#5B5F55]">{liste.length} boutique(s) · chiffres du mois en cours</p>
        </div>
        <button onClick={() => { setEdition({ ...vide }); setMessage(null); }} className={btnVert}>+ Nouvelle boutique</button>
      </div>
      <Message m={message} />

      {edition && (
        <form onSubmit={enregistrer} className={`${carte} grid grid-cols-1 md:grid-cols-3 gap-4`}>
          <Field label="Nom de la boutique">
            <input required autoFocus className={inputCls} value={edition.nom} onChange={(e) => setEdition({ ...edition, nom: e.target.value })} />
          </Field>
          <Field label="Adresse">
            <input className={inputCls} value={edition.adresse || ""} onChange={(e) => setEdition({ ...edition, adresse: e.target.value })} />
          </Field>
          <Field label="Téléphone">
            <input className={inputCls} value={edition.telephone || ""} onChange={(e) => setEdition({ ...edition, telephone: e.target.value })} />
          </Field>
          <div className="md:col-span-3 flex gap-3">
            <button type="submit" className={btnNoir}>Enregistrer</button>
            <button type="button" onClick={() => setEdition(null)} className={btnBord}>Annuler</button>
          </div>
        </form>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {liste.map((b) => {
          const c = chiffres(b.id);
          return (
            <div key={b.id} className="bg-white border border-[#D8D2C2] rounded-sm p-5">
              <div className="flex items-start justify-between gap-3 mb-3">
                <div>
                  <h2 className="bz-serif text-xl font-semibold">{b.nom}</h2>
                  <p className="bz-sans text-xs text-[#9AA0A6]">{[b.adresse, b.telephone].filter(Boolean).join(" · ") || (b.id === BOUTIQUE_PRINCIPALE ? "Vos données d'avant sont ici" : "")}</p>
                </div>
                {boutiqueActive === b.id && <span className="bz-sans text-[11px] uppercase tracking-widest text-[#1F6F5C] font-semibold">Active</span>}
              </div>
              <dl className="grid grid-cols-2 gap-y-2 bz-sans text-sm mb-4">
                <dt className="text-[#5B5F55]">Ventes du mois</dt><dd className="bz-mono text-right text-[#1F6F5C]">{fcfa(c.ventes)}</dd>
                <dt className="text-[#5B5F55]">Dépenses du mois</dt><dd className="bz-mono text-right text-[#B23A2E]">{fcfa(c.depenses)}</dd>
                <dt className="text-[#5B5F55]">Articles en stock</dt><dd className="bz-mono text-right">{c.articles}</dd>
                <dt className="text-[#5B5F55]">Valeur du stock</dt><dd className="bz-mono text-right">{fcfa(c.valeur)}</dd>
              </dl>
              <div className="flex flex-wrap gap-3 bz-sans text-sm">
                {liste.length > 1 && boutiqueActive !== b.id && (
                  <button onClick={() => choisirBoutique(b.id)} className="text-[#1F6F5C] font-medium hover:underline">Travailler dans cette boutique</button>
                )}
                <button onClick={() => { setEdition({ ...vide, ...b }); setMessage(null); }} className="text-[#1B2430] hover:underline">Modifier</button>
                {b.id !== BOUTIQUE_PRINCIPALE && (
                  <button onClick={() => supprimer(b)} className="text-[#C1652F] hover:underline">Supprimer</button>
                )}
              </div>
            </div>
          );
        })}
      </div>
      <p className="bz-sans text-xs text-[#9AA0A6] mt-5">
        Le stock, les ventes, la caisse et les dépenses sont tenus par boutique. Les clients, les fournisseurs, la teinture et les
        commandes de bazins sont communs ; les frais de teinture sont comptés dans la boutique principale. Pour déplacer du tissu
        d'une boutique à l'autre, utilisez « Entrées &amp; inventaire », onglet Transfert.
      </p>
    </div>
  );
}

/* ============================================================
   Entrées de stock, inventaire, transferts, historique
   ============================================================ */
const TYPES_MOUVEMENT = { entree: "Entrée", inventaire: "Inventaire", transfert: "Transfert" };

export function MouvementsView({ stock, saveStock, mouvements, saveMouvements, boutiques, boutiqueActive, fournisseurs, utilisateur, setTab }) {
  const liste = listeBoutiques(boutiques);
  const multi = liste.length > 1;
  const [onglet, setOnglet] = useState("entree");
  const [message, setMessage] = useState(null);
  const articles = useMemo(
    () => (boutiqueActive === TOUTES ? stock : stock.filter((s) => boutiqueDe(s) === boutiqueActive)),
    [stock, boutiqueActive]
  );
  const libelle = (s) => `${s.nom}${multi && boutiqueActive === TOUTES ? ` — ${nomBoutique(boutiques, boutiqueDe(s))}` : ""} (${nbr(s.quantite)} en stock)`;
  const par = utilisateur?.nom || "";
  const noter = (lignes) => saveMouvements([...mouvements, ...lignes]);
  const changer = (t) => { setOnglet(t); setMessage(null); };

  /* ---- Entrée ---- */
  const entreeVide = { stockId: "", quantite: "", prixAchat: "", majPrix: false, fournisseurId: "", date: today(), note: "" };
  const [entree, setEntree] = useState(entreeVide);
  const validerEntree = (e) => {
    e.preventDefault();
    const item = stock.find((s) => s.id === entree.stockId);
    const q = nbr(entree.quantite);
    if (!item || q <= 0) { setMessage({ ton: "erreur", texte: "Choisissez un article et une quantité supérieure à zéro." }); return; }
    const avant = nbr(item.quantite);
    const majPrix = entree.majPrix && entree.prixAchat !== "";
    saveStock(stock.map((s) => (s.id === item.id
      ? { ...s, quantite: avant + q, ...(majPrix ? { prixUnitaire: nbr(entree.prixAchat) } : {}), ...(entree.fournisseurId ? { fournisseurId: entree.fournisseurId } : {}) }
      : s)));
    noter([{ id: uid(), type: "entree", date: entree.date || today(), stockId: item.id, article: item.nom, quantite: q, avant, apres: avant + q,
      prixAchat: entree.prixAchat, fournisseurId: entree.fournisseurId, boutiqueId: boutiqueDe(item), note: entree.note.trim(), par }]);
    setEntree({ ...entreeVide, date: entree.date, fournisseurId: entree.fournisseurId });
    setMessage({ ton: "ok", texte: `Entrée enregistrée : ${item.nom} passe de ${avant} à ${avant + q}.` });
  };

  /* ---- Inventaire ---- */
  const [comptes, setComptes] = useState({});
  const ecarts = articles.filter((s) => comptes[s.id] !== undefined && comptes[s.id] !== "" && nbr(comptes[s.id]) !== nbr(s.quantite));
  const validerInventaire = () => {
    if (ecarts.length === 0) return;
    const ids = new Set(ecarts.map((s) => s.id));
    saveStock(stock.map((s) => (ids.has(s.id) ? { ...s, quantite: nbr(comptes[s.id]) } : s)));
    noter(ecarts.map((s) => ({ id: uid(), type: "inventaire", date: today(), stockId: s.id, article: s.nom,
      quantite: nbr(comptes[s.id]) - nbr(s.quantite), avant: nbr(s.quantite), apres: nbr(comptes[s.id]), boutiqueId: boutiqueDe(s), note: "", par })));
    setComptes({});
    setMessage({ ton: "ok", texte: `Inventaire validé : ${ecarts.length} article(s) corrigé(s).` });
  };

  /* ---- Transfert ---- */
  const transfertVide = { stockId: "", vers: "", quantite: "", note: "" };
  const [transfert, setTransfert] = useState(transfertVide);
  const source = stock.find((s) => s.id === transfert.stockId);
  const destinations = source ? liste.filter((b) => b.id !== boutiqueDe(source)) : [];
  const validerTransfert = (e) => {
    e.preventDefault();
    const q = nbr(transfert.quantite);
    if (!source || !transfert.vers || q <= 0) { setMessage({ ton: "erreur", texte: "Choisissez un article, une boutique d'arrivée et une quantité." }); return; }
    if (q > nbr(source.quantite)) { setMessage({ ton: "erreur", texte: `Il n'y a que ${nbr(source.quantite)} en stock pour ${source.nom}.` }); return; }
    // Même article dans la boutique d'arrivée : même code-barres, sinon même nom
    const cible = stock.find((s) => boutiqueDe(s) === transfert.vers && s.id !== source.id &&
      ((source.codeBarres && s.codeBarres === source.codeBarres) || norm(s.nom) === norm(source.nom)));
    let suivant = stock.map((s) => (s.id === source.id ? { ...s, quantite: nbr(s.quantite) - q } : s));
    let cibleId = cible?.id;
    if (cible) {
      suivant = suivant.map((s) => (s.id === cible.id ? { ...s, quantite: nbr(s.quantite) + q } : s));
    } else {
      cibleId = uid();
      suivant = [...suivant, { ...source, id: cibleId, quantite: q, boutiqueId: transfert.vers }];
    }
    saveStock(suivant);
    noter([{ id: uid(), type: "transfert", date: today(), stockId: source.id, versStockId: cibleId, article: source.nom, quantite: q,
      avant: nbr(source.quantite), apres: nbr(source.quantite) - q, boutiqueId: boutiqueDe(source), versBoutiqueId: transfert.vers, note: transfert.note.trim(), par }]);
    setTransfert(transfertVide);
    setMessage({ ton: "ok", texte: `${q} × ${source.nom} transféré(s) vers ${nomBoutique(boutiques, transfert.vers)}.` });
  };

  /* ---- Historique ---- */
  const [filtreType, setFiltreType] = useState("tous");
  const [limite, setLimite] = useState(50);
  const historique = useMemo(() => {
    const dansBoutique = (m) => boutiqueActive === TOUTES || boutiqueDe(m) === boutiqueActive || m.versBoutiqueId === boutiqueActive;
    return mouvements.filter((m) => (filtreType === "tous" || m.type === filtreType) && dansBoutique(m)).slice().reverse();
  }, [mouvements, filtreType, boutiqueActive]);
  const fournisseurNom = (id) => fournisseurs.find((f) => f.id === id)?.nom || "";
  const exporter = () => exportCSV("bazin-mouvements-stock.csv", historique.map((m) => ({
    ...m, typeLabel: TYPES_MOUVEMENT[m.type] || m.type, boutique: nomBoutique(boutiques, m.boutiqueId),
    vers: m.versBoutiqueId ? nomBoutique(boutiques, m.versBoutiqueId) : "", fournisseur: fournisseurNom(m.fournisseurId),
  })), [
    { key: "date", label: "Date" }, { key: "typeLabel", label: "Type" }, { key: "article", label: "Article" },
    { key: "quantite", label: "Quantité" }, { key: "avant", label: "Avant" }, { key: "apres", label: "Après" },
    { key: "prixAchat", label: "Prix d'achat" }, { key: "fournisseur", label: "Fournisseur" },
    { key: "boutique", label: "Boutique" }, { key: "vers", label: "Vers" }, { key: "par", label: "Par" }, { key: "note", label: "Note" },
  ]);

  const onglets = [["entree", "Entrée"], ["inventaire", "Inventaire"], ["transfert", "Transfert"], ["historique", `Historique (${historique.length})`]];
  const selectArticle = (valeur, onChange) => (
    <select required className={inputCls} value={valeur} onChange={(e) => onChange(e.target.value)}>
      <option value="">— choisir un article —</option>
      {articles.map((s) => <option key={s.id} value={s.id}>{libelle(s)}</option>)}
    </select>
  );

  return (
    <div className="max-w-4xl">
      <h1 className="bz-serif text-3xl font-semibold mb-1">Entrées &amp; inventaire</h1>
      <p className="bz-sans text-[#5B5F55] mb-5">
        Chaque arrivage, correction d'inventaire ou transfert est gardé dans l'historique.
        {multi && boutiqueActive !== TOUTES ? ` Boutique : ${nomBoutique(boutiques, boutiqueActive)}.` : ""}
      </p>
      <div className="flex flex-wrap gap-2 mb-5">
        {onglets.map(([k, l]) => (
          <button key={k} onClick={() => changer(k)}
            className={`bz-sans px-4 py-2 rounded-sm text-sm border ${onglet === k ? "bg-[#1B2430] text-white border-[#1B2430]" : "border-[#D8D2C2] hover:bg-white"}`}>
            {l}
          </button>
        ))}
      </div>
      <Message m={message} />

      {articles.length === 0 && onglet !== "historique" && (
        <div className={carte}>
          <p className="bz-sans text-sm text-[#5B5F55] mb-3">Aucun article dans le stock de cette boutique. Créez d'abord l'article, puis enregistrez ses arrivages ici.</p>
          <button onClick={() => setTab("stock")} className={btnVert}>Ouvrir le stock</button>
        </div>
      )}

      {onglet === "entree" && articles.length > 0 && (
        <form onSubmit={validerEntree} className={`${carte} grid grid-cols-1 md:grid-cols-2 gap-4`}>
          <Field label="Article" className="md:col-span-2">{selectArticle(entree.stockId, (v) => setEntree({ ...entree, stockId: v }))}</Field>
          <Field label="Quantité reçue">
            <input required type="number" min="0" step="any" className={inputCls} value={entree.quantite} onChange={(e) => setEntree({ ...entree, quantite: e.target.value })} />
          </Field>
          <Field label="Date">
            <input type="date" className={inputCls} value={entree.date} onChange={(e) => setEntree({ ...entree, date: e.target.value })} />
          </Field>
          <Field label="Prix d'achat à l'unité (F CFA)">
            <input type="number" min="0" step="1" className={inputCls} value={entree.prixAchat} onChange={(e) => setEntree({ ...entree, prixAchat: e.target.value })} />
          </Field>
          <Field label="Fournisseur">
            <select className={inputCls} value={entree.fournisseurId} onChange={(e) => setEntree({ ...entree, fournisseurId: e.target.value })}>
              <option value="">— aucun —</option>
              {fournisseurs.map((f) => <option key={f.id} value={f.id}>{f.nom}</option>)}
            </select>
          </Field>
          <label className="md:col-span-2 flex items-center gap-2 bz-sans text-sm text-[#1B2430]">
            <input type="checkbox" checked={entree.majPrix} onChange={(e) => setEntree({ ...entree, majPrix: e.target.checked })} />
            Remplacer le prix unitaire de l'article par ce prix d'achat
          </label>
          <Field label="Note" className="md:col-span-2">
            <input className={inputCls} value={entree.note} onChange={(e) => setEntree({ ...entree, note: e.target.value })} />
          </Field>
          <div className="md:col-span-2"><button type="submit" className={btnVert}>Enregistrer l'entrée</button></div>
        </form>
      )}

      {onglet === "inventaire" && articles.length > 0 && (
        <div className={carte}>
          <p className="bz-sans text-sm text-[#5B5F55] mb-4">Comptez le tissu et saisissez la quantité réelle. Seuls les articles dont la quantité change sont corrigés.</p>
          <div className="divide-y divide-[#EFEBDF]">
            {articles.map((s) => {
              const v = comptes[s.id];
              const ecart = v !== undefined && v !== "" ? nbr(v) - nbr(s.quantite) : 0;
              return (
                <div key={s.id} className="py-2 flex flex-wrap items-center gap-3 bz-sans text-sm">
                  <span className="flex-1 min-w-[150px] font-medium">{s.nom}{multi && boutiqueActive === TOUTES ? <span className="text-[#9AA0A6] font-normal"> — {nomBoutique(boutiques, boutiqueDe(s))}</span> : null}</span>
                  <span className="bz-mono text-[#5B5F55]">logiciel : {nbr(s.quantite)}</span>
                  <input type="number" min="0" step="any" placeholder="compté" aria-label={`Quantité comptée pour ${s.nom}`}
                    className={`${inputCls} w-28 text-right`} value={v ?? ""} onChange={(e) => setComptes({ ...comptes, [s.id]: e.target.value })} />
                  <span className={`bz-mono w-16 text-right ${ecart > 0 ? "text-[#1F6F5C]" : ecart < 0 ? "text-[#B23A2E]" : "text-[#9AA0A6]"}`}>
                    {ecart === 0 ? "—" : (ecart > 0 ? "+" : "") + ecart}
                  </span>
                </div>
              );
            })}
          </div>
          <div className="mt-4 flex items-center gap-4">
            <button onClick={validerInventaire} disabled={ecarts.length === 0} className={btnVert}>Valider l'inventaire</button>
            <span className="bz-sans text-sm text-[#5B5F55]">{ecarts.length} écart(s)</span>
          </div>
        </div>
      )}

      {onglet === "transfert" && articles.length > 0 && (
        multi ? (
          <form onSubmit={validerTransfert} className={`${carte} grid grid-cols-1 md:grid-cols-2 gap-4`}>
            <Field label="Article à déplacer" className="md:col-span-2">{selectArticle(transfert.stockId, (v) => setTransfert({ ...transfert, stockId: v, vers: "" }))}</Field>
            <Field label="Vers la boutique">
              <select required className={inputCls} value={transfert.vers} onChange={(e) => setTransfert({ ...transfert, vers: e.target.value })}>
                <option value="">— choisir —</option>
                {destinations.map((b) => <option key={b.id} value={b.id}>{b.nom}</option>)}
              </select>
            </Field>
            <Field label={`Quantité${source ? ` (${nbr(source.quantite)} disponibles)` : ""}`}>
              <input required type="number" min="0" step="any" className={inputCls} value={transfert.quantite} onChange={(e) => setTransfert({ ...transfert, quantite: e.target.value })} />
            </Field>
            <Field label="Note" className="md:col-span-2">
              <input className={inputCls} value={transfert.note} onChange={(e) => setTransfert({ ...transfert, note: e.target.value })} />
            </Field>
            <div className="md:col-span-2"><button type="submit" className={btnVert}>Transférer</button></div>
          </form>
        ) : (
          <div className={carte}>
            <p className="bz-sans text-sm text-[#5B5F55] mb-3">Vous n'avez qu'une boutique. Créez-en une deuxième pour transférer du stock.</p>
            <button onClick={() => setTab("boutiques")} className={btnVert}>Ouvrir les boutiques</button>
          </div>
        )
      )}

      {onglet === "historique" && (
        <div className={carte}>
          <div className="flex flex-wrap items-center gap-3 mb-4">
            <select className={inputCls} value={filtreType} onChange={(e) => setFiltreType(e.target.value)} aria-label="Type de mouvement">
              <option value="tous">Tous les mouvements</option>
              {Object.entries(TYPES_MOUVEMENT).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </select>
            <button onClick={exporter} disabled={historique.length === 0} className={btnBord}>Exporter CSV</button>
          </div>
          {historique.length === 0 ? (
            <p className="bz-sans text-sm text-[#9AA0A6]">Aucun mouvement enregistré pour l'instant.</p>
          ) : (
            <div className="divide-y divide-[#EFEBDF]">
              {historique.slice(0, limite).map((m) => (
                <div key={m.id} className="py-2 bz-sans text-sm">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <span><b>{TYPES_MOUVEMENT[m.type] || m.type}</b> · {m.article}</span>
                    <span className={`bz-mono ${m.type === "inventaire" && nbr(m.quantite) < 0 ? "text-[#B23A2E]" : "text-[#1F6F5C]"}`}>
                      {m.type === "transfert" ? "" : nbr(m.quantite) > 0 ? "+" : ""}{nbr(m.quantite)}
                    </span>
                  </div>
                  <div className="text-xs text-[#5B5F55]">
                    {[fmtDate(m.date),
                      m.type === "transfert" ? `${nomBoutique(boutiques, m.boutiqueId)} → ${nomBoutique(boutiques, m.versBoutiqueId)}` : (multi ? nomBoutique(boutiques, m.boutiqueId) : ""),
                      m.type !== "transfert" ? `${m.avant} → ${m.apres}` : "",
                      m.prixAchat !== undefined && m.prixAchat !== "" ? `achat ${fcfa(m.prixAchat)}` : "",
                      fournisseurNom(m.fournisseurId), m.par ? `par ${m.par}` : "", m.note].filter(Boolean).join(" · ")}
                  </div>
                </div>
              ))}
            </div>
          )}
          {historique.length > limite && (
            <button onClick={() => setLimite(limite + 100)} className="mt-3 bz-sans text-sm text-[#1F6F5C] underline">Afficher la suite</button>
          )}
        </div>
      )}
    </div>
  );
}

/* ============================================================
   Codes-barres
   ============================================================ */
const codeNorm = (c) => String(c ?? "").trim().toUpperCase();

/* Retrouve un article par son code ; la boutique active passe en premier */
export function trouverParCode(stock, code, boutiqueActive = TOUTES) {
  const c = codeNorm(code);
  if (!c) return null;
  const trouves = stock.filter((s) => codeNorm(s.codeBarres) === c);
  return trouves.find((s) => boutiqueActive !== TOUTES && boutiqueDe(s) === boutiqueActive) || trouves[0] || null;
}

/* Prochain code libre, au format BZ000123 */
function prochainCode(stock, dejaPris = []) {
  const pris = new Set([...stock.map((s) => codeNorm(s.codeBarres)), ...dejaPris.map(codeNorm)]);
  let n = 0;
  pris.forEach((c) => { const m = /^BZ(\d+)$/.exec(c); if (m) n = Math.max(n, Number(m[1])); });
  let code;
  do { n += 1; code = "BZ" + String(n).padStart(6, "0"); } while (pris.has(code));
  return code;
}

export function CodeBarres({ code, hauteur = 44, largeur = 1.6 }) {
  const ref = useRef(null);
  const [invalide, setInvalide] = useState(false);
  useEffect(() => {
    if (!ref.current) return;
    try {
      JsBarcode(ref.current, code, { format: "CODE128", height: hauteur, width: largeur, margin: 6, fontSize: 13, textMargin: 2, displayValue: true });
      setInvalide(false);
    } catch { setInvalide(true); }
  }, [code, hauteur, largeur]);
  if (invalide) return <span className="bz-sans text-xs text-[#B23A2E]">Code illisible</span>;
  return <svg ref={ref} role="img" aria-label={`Code-barres ${code}`} />;
}

/* Lecture d'un code avec l'appareil photo (Chrome sur Android). Sinon : saisie ou douchette. */
const cameraPossible = () => typeof window !== "undefined" && "BarcodeDetector" in window && !!navigator.mediaDevices?.getUserMedia;

function ScannerCamera({ onCode, onFermer }) {
  const video = useRef(null);
  const [erreur, setErreur] = useState("");
  useEffect(() => {
    let flux = null; let actif = true; let minuterie = null;
    (async () => {
      try {
        const detecteur = new window.BarcodeDetector({ formats: ["code_128", "ean_13", "ean_8", "code_39", "qr_code"] });
        flux = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
        if (!actif) { flux.getTracks().forEach((t) => t.stop()); return; }
        video.current.srcObject = flux;
        await video.current.play();
        const lire = async () => {
          if (!actif) return;
          try {
            const codes = await detecteur.detect(video.current);
            if (codes.length > 0 && codes[0].rawValue) { onCode(codes[0].rawValue); return; }
          } catch { /* image pas encore prête */ }
          minuterie = setTimeout(lire, 250);
        };
        lire();
      } catch {
        setErreur("Impossible d'utiliser l'appareil photo. Autorisez-le dans le navigateur, ou tapez le code.");
      }
    })();
    return () => { actif = false; clearTimeout(minuterie); flux?.getTracks().forEach((t) => t.stop()); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className="fixed inset-0 z-[60] bg-black/90 flex flex-col items-center justify-center p-4 bz-no-print">
      {erreur ? <p className="bz-sans text-white text-center mb-4">{erreur}</p> : (
        <>
          <video ref={video} playsInline muted className="w-full max-w-md rounded-sm" />
          <p className="bz-sans text-white/80 text-sm mt-3">Placez le code-barres devant l'appareil photo.</p>
        </>
      )}
      <button onClick={onFermer} className="mt-4 bz-sans px-4 py-2 rounded-sm text-sm bg-white text-[#1B2430]">Fermer</button>
    </div>
  );
}

/* Champ « code-barres » : saisie au clavier, douchette (qui tape puis Entrée) ou appareil photo */
export function ChampCode({ onCode, placeholder = "Code-barres", className = "" }) {
  const [valeur, setValeur] = useState("");
  const [camera, setCamera] = useState(false);
  const envoyer = (c) => { const code = String(c || "").trim(); if (code) onCode(code); setValeur(""); };
  return (
    <div className={`flex gap-2 items-center ${className}`}>
      <input className={`${inputCls} w-40 bz-mono text-sm`} placeholder={placeholder} value={valeur} aria-label={placeholder}
        onChange={(e) => setValeur(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); envoyer(valeur); } }} />
      <button type="button" onClick={() => envoyer(valeur)} className={btnBord}>OK</button>
      {cameraPossible() && <button type="button" onClick={() => setCamera(true)} className={btnBord} aria-label="Scanner avec l'appareil photo">📷 Scanner</button>}
      {camera && <ScannerCamera onCode={(c) => { setCamera(false); envoyer(c); }} onFermer={() => setCamera(false)} />}
    </div>
  );
}

export function CodesBarresView({ stock, saveStock, boutiques, boutiqueActive }) {
  const multi = listeBoutiques(boutiques).length > 1;
  const articles = useMemo(
    () => (boutiqueActive === TOUTES ? stock : stock.filter((s) => boutiqueDe(s) === boutiqueActive)),
    [stock, boutiqueActive]
  );
  const [quantites, setQuantites] = useState({});
  const [entete, setEntete] = useState("Bazin Mari Falah");
  const [avecPrix, setAvecPrix] = useState(false);
  const [apercu, setApercu] = useState(false);
  const [message, setMessage] = useState(null);
  const [trouve, setTrouve] = useState(null); // { code, items }
  const sansCode = articles.filter((s) => !codeNorm(s.codeBarres));

  // Le même article dans une autre boutique garde le même code
  const generer = (ids) => {
    const nouveaux = {};
    const parNom = new Map(); // nom de l'article → code (existant ou créé dans ce lot)
    stock.forEach((s) => { if (codeNorm(s.codeBarres) && !parNom.has(norm(s.nom))) parNom.set(norm(s.nom), codeNorm(s.codeBarres)); });
    stock.forEach((s) => {
      if (!ids.includes(s.id) || codeNorm(s.codeBarres)) return;
      if (!parNom.has(norm(s.nom))) parNom.set(norm(s.nom), prochainCode(stock, [...parNom.values()]));
      nouveaux[s.id] = parNom.get(norm(s.nom));
    });
    if (Object.keys(nouveaux).length === 0) return;
    saveStock(stock.map((s) => (nouveaux[s.id] ? { ...s, codeBarres: nouveaux[s.id] } : s)));
    setMessage({ ton: "ok", texte: `${Object.keys(nouveaux).length} code(s) créé(s).` });
  };
  const changerCode = (s, valeur) => {
    const code = codeNorm(valeur).replace(/[^\x20-\x7E]/g, "");
    const conflit = code && stock.find((x) => x.id !== s.id && codeNorm(x.codeBarres) === code && norm(x.nom) !== norm(s.nom));
    if (conflit) { setMessage({ ton: "erreur", texte: `Le code ${code} est déjà utilisé par « ${conflit.nom} ».` }); return; }
    setMessage(null);
    saveStock(stock.map((x) => (x.id === s.id ? { ...x, codeBarres: code } : x)));
  };

  const etiquettes = articles.flatMap((s) => (codeNorm(s.codeBarres) ? Array.from({ length: Math.min(200, Math.max(0, Math.floor(nbr(quantites[s.id])))) }, () => s) : []));
  const chercher = (code) => setTrouve({ code: codeNorm(code), items: stock.filter((s) => codeNorm(s.codeBarres) === codeNorm(code)) });

  // Pendant l'aperçu, seule la planche d'étiquettes doit partir à l'impression
  useEffect(() => {
    if (!apercu) return undefined;
    document.body.classList.add("bz-impression");
    return () => document.body.classList.remove("bz-impression");
  }, [apercu]);

  if (apercu) {
    return createPortal(
      <div className="bz-print-root fixed inset-0 z-50 bg-white overflow-y-auto">
        <div className="bz-no-print sticky top-0 bg-[#1B2430] text-white px-4 py-3 flex items-center justify-between">
          <span className="bz-sans text-sm">{etiquettes.length} étiquette(s)</span>
          <div className="flex gap-2">
            <button onClick={() => window.print()} className="bz-sans px-4 py-1.5 rounded-sm text-sm bg-[#D6A756] text-[#1B2430] font-medium">Imprimer</button>
            <button onClick={() => setApercu(false)} className="bz-sans px-4 py-1.5 rounded-sm text-sm border border-white/30">Fermer</button>
          </div>
        </div>
        <div className="bz-print-area p-3 flex flex-wrap gap-2 content-start">
          {etiquettes.map((s, i) => (
            <div key={i} className="bz-etiquette border border-dashed border-[#9AA0A6] rounded-sm px-2 py-1.5 flex flex-col items-center text-center" style={{ width: "60mm", breakInside: "avoid" }}>
              {entete.trim() && <div className="bz-serif text-[11px] font-semibold tracking-wide">{entete.trim()}</div>}
              <div className="bz-sans text-[12px] font-medium leading-tight">{s.nom}</div>
              <CodeBarres code={codeNorm(s.codeBarres)} hauteur={36} largeur={1.4} />
              {avecPrix && nbr(s.prixVente) > 0 && <div className="bz-mono text-[12px] font-semibold">{fcfa(s.prixVente)}</div>}
            </div>
          ))}
        </div>
      </div>,
      document.body
    );
  }

  return (
    <div className="max-w-4xl">
      <h1 className="bz-serif text-3xl font-semibold mb-1">Codes-barres</h1>
      <p className="bz-sans text-[#5B5F55] mb-5">Donnez un code à chaque article, imprimez les étiquettes, puis vendez en tapant ou en scannant le code.</p>
      <Message m={message} />

      <div className={carte}>
        <h2 className="bz-serif text-xl font-semibold mb-3">Trouver un article par son code</h2>
        <ChampCode onCode={chercher} placeholder="Code de l'article" />
        {trouve && (
          <div className="mt-4 bz-sans text-sm">
            {trouve.items.length === 0 ? <p className="text-[#B23A2E]">Aucun article avec le code {trouve.code}.</p> : trouve.items.map((s) => (
              <p key={s.id}><b>{s.nom}</b> · {nbr(s.quantite)} en stock{multi ? ` · ${nomBoutique(boutiques, boutiqueDe(s))}` : ""}{nbr(s.prixVente) > 0 ? ` · ${fcfa(s.prixVente)}` : ""}</p>
            ))}
          </div>
        )}
      </div>

      <div className={carte}>
        <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
          <h2 className="bz-serif text-xl font-semibold">Articles et étiquettes</h2>
          {sansCode.length > 0 && (
            <button onClick={() => generer(sansCode.map((s) => s.id))} className={btnVert}>Créer les {sansCode.length} code(s) manquant(s)</button>
          )}
        </div>
        {articles.length === 0 ? <p className="bz-sans text-sm text-[#9AA0A6]">Aucun article dans le stock.</p> : (
          <div className="divide-y divide-[#EFEBDF]">
            {articles.map((s) => (
              <div key={s.id} className="py-3 flex flex-wrap items-center gap-3 bz-sans text-sm">
                <span className="flex-1 min-w-[150px] font-medium">{s.nom}{multi && boutiqueActive === TOUTES ? <span className="text-[#9AA0A6] font-normal"> — {nomBoutique(boutiques, boutiqueDe(s))}</span> : null}</span>
                {codeNorm(s.codeBarres) ? (
                  <>
                    <input key={s.codeBarres} defaultValue={s.codeBarres} aria-label={`Code de ${s.nom}`} className={`${inputCls} w-36 bz-mono`}
                      onBlur={(e) => { if (codeNorm(e.target.value) !== codeNorm(s.codeBarres)) changerCode(s, e.target.value); }} />
                    <label className="flex items-center gap-2 text-[#5B5F55]">Étiquettes
                      <input type="number" min="0" max="200" step="1" aria-label={`Nombre d'étiquettes pour ${s.nom}`} className={`${inputCls} w-20 text-right`}
                        value={quantites[s.id] ?? ""} onChange={(e) => setQuantites({ ...quantites, [s.id]: e.target.value })} />
                    </label>
                  </>
                ) : (
                  <button onClick={() => generer([s.id])} className="text-[#1F6F5C] font-medium hover:underline">Créer un code</button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className={carte}>
        <h2 className="bz-serif text-xl font-semibold mb-3">Imprimer</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <Field label="Texte en haut de l'étiquette">
            <input className={inputCls} value={entete} onChange={(e) => setEntete(e.target.value)} />
          </Field>
          <label className="flex items-center gap-2 bz-sans text-sm self-end pb-2">
            <input type="checkbox" checked={avecPrix} onChange={(e) => setAvecPrix(e.target.checked)} />
            Afficher le prix de vente (s'il est renseigné dans le stock)
          </label>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button onClick={() => setApercu(true)} disabled={etiquettes.length === 0} className={btnNoir}>Voir et imprimer {etiquettes.length} étiquette(s)</button>
          <button onClick={() => { const q = {}; articles.forEach((s) => { if (codeNorm(s.codeBarres)) q[s.id] = Math.min(200, Math.max(1, Math.round(nbr(s.quantite)))); }); setQuantites(q); }} className={btnBord}>
            Une étiquette par unité en stock
          </button>
        </div>
      </div>
    </div>
  );
}

/* ============================================================
   Utilisateurs, code PIN et écrans autorisés
   ============================================================ */
const hexa = (octets) => Array.from(octets).map((b) => b.toString(16).padStart(2, "0")).join("");
const aleaHexa = (n = 16) => { const o = new Uint8Array(n); crypto.getRandomValues(o); return hexa(o); };

/* Empreinte du PIN : le PIN lui-même n'est jamais enregistré */
export async function hacherPin(sel, pin) {
  const texte = `${sel}:${pin}`;
  if (globalThis.crypto?.subtle) {
    const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(texte));
    return hexa(new Uint8Array(d));
  }
  // Secours hors contexte sécurisé (ne devrait pas arriver sur le site en https)
  let h1 = 0x811c9dc5, h2 = 0x1b873593;
  for (let i = 0; i < texte.length; i++) {
    h1 = Math.imul(h1 ^ texte.charCodeAt(i), 0x01000193);
    h2 = Math.imul(h2 ^ texte.charCodeAt(i), 0x85ebca6b);
  }
  return "x" + (h1 >>> 0).toString(16) + (h2 >>> 0).toString(16);
}
const pinValide = (p) => /^\d{4,8}$/.test(p);
export const estPatron = (u) => !!u && u.role === "patron";

/* Écrans visibles pour un utilisateur. Sans aucun compte, tout est ouvert comme avant. */
export function ecransAutorises(utilisateur, ecrans) {
  if (!utilisateur || estPatron(utilisateur)) return ecrans.map(([k]) => k);
  const permis = new Set(utilisateur.ecrans || []);
  return ecrans.filter(([k, , patronSeul]) => !patronSeul && permis.has(k)).map(([k]) => k);
}

const ECRANS_VENDEUR = ["caisse", "ventes", "rappels", "clients", "stock", "commandes"];

export function UtilisateursView({ utilisateurs, saveUtilisateurs, ecrans, boutiques, utilisateur, ouvrirSession, fermerSession }) {
  const liste = listeBoutiques(boutiques);
  const multi = liste.length > 1;
  const attribuables = ecrans.filter(([, , patronSeul]) => !patronSeul);
  const vide = { id: "", nom: "", role: "employe", pin: "", pin2: "", boutiqueId: "", ecrans: [...ECRANS_VENDEUR] };
  const [edition, setEdition] = useState(null);
  const [message, setMessage] = useState(null);
  const [secours, setSecours] = useState(""); // code de secours à montrer une seule fois
  const aucun = utilisateurs.length === 0;

  if (!aucun && !estPatron(utilisateur)) {
    return <div className="max-w-3xl"><h1 className="bz-serif text-3xl font-semibold mb-2">Utilisateurs &amp; accès</h1><p className="bz-sans text-[#5B5F55]">Cette page est réservée au patron.</p></div>;
  }

  const enregistrer = async (e) => {
    e.preventDefault();
    const nom = edition.nom.trim();
    const nouveau = !edition.id;
    if (!nom) return;
    if (utilisateurs.some((u) => u.id !== edition.id && norm(u.nom) === norm(nom))) { setMessage({ ton: "erreur", texte: "Un utilisateur porte déjà ce nom." }); return; }
    if ((nouveau || edition.pin) && !pinValide(edition.pin)) { setMessage({ ton: "erreur", texte: "Le code PIN doit avoir 4 à 8 chiffres." }); return; }
    if ((nouveau || edition.pin) && edition.pin !== edition.pin2) { setMessage({ ton: "erreur", texte: "Les deux codes PIN ne sont pas identiques." }); return; }
    const role = aucun ? "patron" : edition.role;
    const ancien = utilisateurs.find((u) => u.id === edition.id);
    if (ancien && estPatron(ancien) && role !== "patron" && utilisateurs.filter(estPatron).length === 1) {
      setMessage({ ton: "erreur", texte: "Il doit rester au moins un patron." }); return;
    }
    const fiche = { id: edition.id || uid(), nom, role, boutiqueId: role === "patron" ? "" : edition.boutiqueId || "", ecrans: role === "patron" ? [] : edition.ecrans,
      sel: ancien?.sel || "", pinHash: ancien?.pinHash || "", ...(ancien?.secoursHash ? { secoursSel: ancien.secoursSel, secoursHash: ancien.secoursHash } : {}) };
    if (edition.pin) { fiche.sel = aleaHexa(); fiche.pinHash = await hacherPin(fiche.sel, edition.pin); }
    let codeSecours = "";
    if (role === "patron" && !fiche.secoursHash) {
      const o = new Uint32Array(1); crypto.getRandomValues(o);
      codeSecours = String(o[0] % 100000000).padStart(8, "0");
      fiche.secoursSel = aleaHexa(); fiche.secoursHash = await hacherPin(fiche.secoursSel, codeSecours);
    }
    saveUtilisateurs(ancien ? utilisateurs.map((u) => (u.id === fiche.id ? fiche : u)) : [...utilisateurs, fiche]);
    if (aucun) ouvrirSession(fiche.id); // le patron qui vient de créer son compte reste connecté
    setEdition(null);
    setSecours(codeSecours);
    setMessage({ ton: "ok", texte: ancien ? "Utilisateur modifié." : `Compte « ${nom} » créé.` });
  };

  const supprimer = (u) => {
    if (estPatron(u) && utilisateurs.filter(estPatron).length === 1 && utilisateurs.length > 1) {
      setMessage({ ton: "erreur", texte: "Supprimez d'abord les autres comptes : il doit rester un patron." }); return;
    }
    const reste = utilisateurs.filter((x) => x.id !== u.id);
    saveUtilisateurs(reste);
    if (reste.length === 0 || u.id === utilisateur?.id) fermerSession();
    setMessage({ ton: "ok", texte: reste.length === 0 ? "Plus aucun compte : l'application s'ouvre de nouveau sans code." : "Utilisateur supprimé." });
  };

  const cocher = (k) => setEdition({ ...edition, ecrans: edition.ecrans.includes(k) ? edition.ecrans.filter((x) => x !== k) : [...edition.ecrans, k] });

  return (
    <div className="max-w-3xl">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <div>
          <h1 className="bz-serif text-3xl font-semibold">Utilisateurs &amp; accès</h1>
          <p className="bz-sans text-[#5B5F55]">{aucun ? "Aucun compte : l'application s'ouvre sans code." : `${utilisateurs.length} compte(s) · un code PIN est demandé à l'ouverture`}</p>
        </div>
        {!aucun && !edition && <button onClick={() => { setEdition({ ...vide }); setMessage(null); setSecours(""); }} className={btnVert}>+ Nouvel utilisateur</button>}
      </div>
      <Message m={message} />

      {secours && (
        <div className="mb-5 px-4 py-4 rounded-sm border-2 border-[#B9832F] bg-[#FBF3E1]">
          <p className="bz-sans text-sm text-[#6B4A12] mb-2"><b>Code de secours du patron</b> — notez-le sur papier maintenant. Il ne sera plus jamais affiché. Il sert si vous oubliez votre code PIN.</p>
          <p className="bz-mono text-3xl tracking-[0.2em] text-[#1B2430]" data-secours>{secours.slice(0, 4)} {secours.slice(4)}</p>
          <button onClick={() => setSecours("")} className={`${btnNoir} mt-3`}>J'ai noté le code</button>
        </div>
      )}

      {aucun && !edition && (
        <div className={carte}>
          <p className="bz-sans text-sm text-[#1B2430] mb-3">
            Créez d'abord votre compte de patron. Ensuite, chaque employé aura son nom, son code PIN et seulement les écrans que vous choisissez.
          </p>
          <button onClick={() => setEdition({ ...vide, role: "patron" })} className={btnVert}>Créer mon compte patron</button>
        </div>
      )}

      {edition && (
        <form onSubmit={enregistrer} className={`${carte} grid grid-cols-1 md:grid-cols-2 gap-4`}>
          <Field label="Nom">
            <input required autoFocus className={inputCls} value={edition.nom} onChange={(e) => setEdition({ ...edition, nom: e.target.value })} />
          </Field>
          {aucun ? <div className="bz-sans text-sm text-[#5B5F55] self-end pb-2">Rôle : Patron (tous les écrans)</div> : (
            <Field label="Rôle">
              <select className={inputCls} value={edition.role} onChange={(e) => setEdition({ ...edition, role: e.target.value })}>
                <option value="employe">Employé (écrans choisis)</option>
                <option value="patron">Patron (tous les écrans)</option>
              </select>
            </Field>
          )}
          <Field label={edition.id ? "Nouveau code PIN (vide = inchangé)" : "Code PIN (4 à 8 chiffres)"}>
            <input type="password" inputMode="numeric" autoComplete="new-password" className={inputCls} value={edition.pin} onChange={(e) => setEdition({ ...edition, pin: e.target.value.replace(/\D/g, "").slice(0, 8) })} />
          </Field>
          <Field label="Répéter le code PIN">
            <input type="password" inputMode="numeric" autoComplete="new-password" className={inputCls} value={edition.pin2} onChange={(e) => setEdition({ ...edition, pin2: e.target.value.replace(/\D/g, "").slice(0, 8) })} />
          </Field>
          {(aucun ? "patron" : edition.role) !== "patron" && (
            <>
              {multi && (
                <Field label="Boutique" className="md:col-span-2">
                  <select className={inputCls} value={edition.boutiqueId || ""} onChange={(e) => setEdition({ ...edition, boutiqueId: e.target.value })}>
                    <option value="">Toutes les boutiques</option>
                    {liste.map((b) => <option key={b.id} value={b.id}>Seulement {b.nom}</option>)}
                  </select>
                </Field>
              )}
              <div className="md:col-span-2">
                <div className="flex flex-wrap items-center gap-3 mb-2">
                  <span className="bz-sans text-sm text-[#5B5F55] font-medium">Écrans autorisés</span>
                  <button type="button" onClick={() => setEdition({ ...edition, ecrans: [...ECRANS_VENDEUR] })} className="bz-sans text-xs text-[#1F6F5C] underline">Vendeur</button>
                  <button type="button" onClick={() => setEdition({ ...edition, ecrans: attribuables.map(([k]) => k) })} className="bz-sans text-xs text-[#1F6F5C] underline">Tout</button>
                  <button type="button" onClick={() => setEdition({ ...edition, ecrans: [] })} className="bz-sans text-xs text-[#1F6F5C] underline">Rien</button>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-1">
                  {attribuables.map(([k, l]) => (
                    <label key={k} className="flex items-center gap-2 bz-sans text-sm">
                      <input type="checkbox" checked={edition.ecrans.includes(k)} onChange={() => cocher(k)} /> {l}
                    </label>
                  ))}
                </div>
              </div>
            </>
          )}
          <div className="md:col-span-2 flex gap-3">
            <button type="submit" className={btnNoir}>Enregistrer</button>
            <button type="button" onClick={() => setEdition(null)} className={btnBord}>Annuler</button>
          </div>
        </form>
      )}

      {!aucun && (
        <div className="bg-white border border-[#D8D2C2] rounded-sm divide-y divide-[#EFEBDF] mb-5">
          {utilisateurs.map((u) => (
            <div key={u.id} className="px-5 py-3 flex flex-wrap items-center justify-between gap-3 bz-sans text-sm">
              <div>
                <div className="font-medium">{u.nom}{u.id === utilisateur?.id ? " (vous)" : ""}</div>
                <div className="text-xs text-[#5B5F55]">
                  {estPatron(u) ? "Patron · tous les écrans" : `Employé · ${(u.ecrans || []).length} écran(s)${u.boutiqueId ? ` · ${nomBoutique(boutiques, u.boutiqueId)}` : ""}`}
                </div>
              </div>
              <div className="flex gap-3">
                <button onClick={() => { setEdition({ ...vide, ...u, ecrans: u.ecrans || [], pin: "", pin2: "" }); setMessage(null); setSecours(""); }} className="text-[#1F6F5C] hover:underline">Modifier</button>
                <button onClick={() => supprimer(u)} className="text-[#C1652F] hover:underline">Supprimer</button>
              </div>
            </div>
          ))}
        </div>
      )}

      <p className="bz-sans text-xs text-[#9AA0A6]">
        Le code PIN ferme l'application aux personnes qui prennent le téléphone ou l'ordinateur. Les données restent enregistrées sur
        l'appareil : quelqu'un qui connaît bien l'informatique pourrait les lire sans passer par l'application. Une protection complète
        demandera la version en ligne.
      </p>
    </div>
  );
}

/* ---------- Écran de verrouillage ---------- */
const MAX_ESSAIS = 5;
const ATTENTE_S = 30;

export function EcranVerrou({ utilisateurs, onOuvert }) {
  const [choisi, setChoisi] = useState(utilisateurs.length === 1 ? utilisateurs[0].id : "");
  const [pin, setPin] = useState("");
  const [erreur, setErreur] = useState("");
  const [essais, setEssais] = useState(0);
  const [bloqueJusqua, setBloqueJusqua] = useState(0);
  const [reste, setReste] = useState(0);
  const [modeSecours, setModeSecours] = useState(false);
  const [code, setCode] = useState("");
  const u = utilisateurs.find((x) => x.id === choisi);

  useEffect(() => {
    if (!bloqueJusqua) return undefined;
    const maj = () => { const r = Math.ceil((bloqueJusqua - Date.now()) / 1000); setReste(Math.max(0, r)); if (r <= 0) { setBloqueJusqua(0); setEssais(0); setErreur(""); } };
    maj();
    const t = setInterval(maj, 500);
    return () => clearInterval(t);
  }, [bloqueJusqua]);

  const rate = () => {
    const n = essais + 1;
    setEssais(n);
    if (n >= MAX_ESSAIS) { setBloqueJusqua(Date.now() + ATTENTE_S * 1000); setErreur(`Trop d'essais. Attendez ${ATTENTE_S} secondes.`); }
    else setErreur("Code incorrect.");
  };
  const entrer = async (e) => {
    e.preventDefault();
    if (!u || bloqueJusqua) return;
    if ((await hacherPin(u.sel, pin)) === u.pinHash) onOuvert(u.id);
    else { setPin(""); rate(); }
  };
  const entrerSecours = async (e) => {
    e.preventDefault();
    if (bloqueJusqua) return;
    const saisi = code.replace(/\D/g, "");
    for (const p of utilisateurs.filter((x) => estPatron(x) && x.secoursHash)) {
      if ((await hacherPin(p.secoursSel, saisi)) === p.secoursHash) { onOuvert(p.id, true); return; }
    }
    setCode(""); rate();
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#1B2430] px-4">
      <div className="w-full max-w-sm bg-[#F0EDE4] rounded-sm p-6">
        <div className="bz-serif text-3xl font-semibold text-[#1B2430] mb-1">Bazin</div>
        <p className="bz-sans text-sm text-[#5B5F55] mb-5">{modeSecours ? "Entrez le code de secours du patron." : "Choisissez votre nom et entrez votre code PIN."}</p>
        {modeSecours ? (
          <form onSubmit={entrerSecours} className="flex flex-col gap-3">
            <input autoFocus inputMode="numeric" aria-label="Code de secours" placeholder="Code de secours (8 chiffres)" className={`${inputCls} bz-mono text-lg tracking-widest`}
              value={code} onChange={(e) => setCode(e.target.value.replace(/[^\d ]/g, "").slice(0, 9))} disabled={!!bloqueJusqua} />
            <button type="submit" disabled={!!bloqueJusqua || code.replace(/\D/g, "").length < 8} className={btnVert}>Ouvrir</button>
            <button type="button" onClick={() => { setModeSecours(false); setErreur(""); }} className="bz-sans text-sm text-[#5B5F55] underline">Retour</button>
          </form>
        ) : (
          <form onSubmit={entrer} className="flex flex-col gap-3">
            <div className="flex flex-wrap gap-2">
              {utilisateurs.map((x) => (
                <button type="button" key={x.id} onClick={() => { setChoisi(x.id); setPin(""); setErreur(""); }}
                  className={`bz-sans px-3 py-2 rounded-sm text-sm border ${choisi === x.id ? "bg-[#1B2430] text-white border-[#1B2430]" : "border-[#D8D2C2] bg-white text-[#1B2430]"}`}>
                  {x.nom}
                </button>
              ))}
            </div>
            <input key={choisi} autoFocus type="password" inputMode="numeric" autoComplete="off" aria-label="Code PIN" placeholder="Code PIN"
              className={`${inputCls} bz-mono text-lg tracking-widest`} value={pin} disabled={!u || !!bloqueJusqua}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 8))} />
            <button type="submit" disabled={!u || pin.length < 4 || !!bloqueJusqua} className={btnVert}>Ouvrir</button>
            <button type="button" onClick={() => { setModeSecours(true); setErreur(""); }} className="bz-sans text-sm text-[#5B5F55] underline">Code PIN oublié ?</button>
          </form>
        )}
        {erreur && <p role="alert" className="bz-sans text-sm text-[#B23A2E] mt-3">{erreur}{bloqueJusqua ? ` (${reste} s)` : ""}</p>}
      </div>
    </div>
  );
}
