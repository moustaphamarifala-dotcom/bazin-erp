import React, { useEffect, useMemo, useRef, useState } from "react";

/* ============================================================
   Outils transversaux de Bazin :
   - sauvegarde / restauration de toutes les données
   - recherche globale dans tous les modules
   - installation de l'application sur le téléphone
   ============================================================ */

/* Toutes les données de l'application : [nom interne, clé de stockage, libellé] */
export const CLES_DONNEES = [
  ["clients", "bazin:clients", "Clients"],
  ["fournisseurs", "bazin:fournisseurs", "Fournisseurs"],
  ["stock", "bazin:stock", "Stock"],
  ["docs", "bazin:documents", "Factures & devis"],
  ["depenses", "bazin:depenses", "Dépenses"],
  ["teintures", "bazin:teintures", "Teinturiers"],
  ["paiementsTeint", "bazin:paiementsTeint", "Paiements aux teinturiers"],
  ["commandes", "bazin:commandes", "Commandes de bazins"],
  ["ventes", "bazin:ventes", "Ventes"],
  ["caisse", "bazin:caisse", "Caisse"],
  ["productions", "bazin:productions", "Teinture entreprise"],
  ["videos", "bazin:videos", "Studio TikTok"],
];
export const CLE_DERNIERE_SAUVEGARDE = "bazin:derniereSauvegarde";
const CLE_AVANT_RESTAURATION = "bazin:avantRestauration";
const JOURS_AVANT_RAPPEL = 7;

const nbr = (x) => Number(x) || 0;
const fcfa = (n) =>
  nbr(n).toLocaleString("fr-FR", { style: "currency", currency: "XOF", maximumFractionDigits: 0 });
const fmtDate = (iso) => {
  if (!iso) return "";
  const [y, m, d] = String(iso).slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
};
const jourISO = (d = new Date()) => {
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

/* ---------- Sauvegarde : fonctions pures ---------- */
export function totalEnregistrements(donnees) {
  return CLES_DONNEES.reduce((s, [nom]) => s + (Array.isArray(donnees[nom]) ? donnees[nom].length : 0), 0);
}

export function construireSauvegarde(donnees) {
  const contenu = {};
  CLES_DONNEES.forEach(([nom]) => { contenu[nom] = Array.isArray(donnees[nom]) ? donnees[nom] : []; });
  return { app: "bazin-erp", version: 1, date: new Date().toISOString(), donnees: contenu };
}

/* Vérifie un fichier de sauvegarde. Renvoie { ok, erreur } ou { ok, date, donnees }.
   Seuls les modules connus et bien formés sont repris. */
export function validerSauvegarde(obj) {
  if (!obj || typeof obj !== "object" || obj.app !== "bazin-erp" || !obj.donnees || typeof obj.donnees !== "object") {
    return { ok: false, erreur: "Ce fichier n'est pas une sauvegarde Bazin." };
  }
  const donnees = {};
  for (const [nom, , libelle] of CLES_DONNEES) {
    const v = obj.donnees[nom];
    if (v === undefined) continue;
    if (!Array.isArray(v) || v.some((x) => !x || typeof x !== "object" || Array.isArray(x))) {
      return { ok: false, erreur: `La partie « ${libelle} » du fichier est abîmée. Rien n'a été modifié.` };
    }
    donnees[nom] = v;
  }
  if (Object.keys(donnees).length === 0) {
    return { ok: false, erreur: "Ce fichier ne contient aucune donnée Bazin." };
  }
  return { ok: true, date: typeof obj.date === "string" ? obj.date : "", donnees };
}

const nomFichier = (prefixe = "bazin-sauvegarde") => `${prefixe}-${jourISO()}.json`;

function telechargerJSON(nom, objet) {
  const blob = new Blob([JSON.stringify(objet)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nom;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/* Télécharge la sauvegarde complète et renvoie la date enregistrée */
export function telechargerSauvegarde(donnees) {
  const sauvegarde = construireSauvegarde(donnees);
  telechargerJSON(nomFichier(), sauvegarde);
  return sauvegarde.date;
}

export function joursDepuis(iso) {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return null;
  return Math.max(0, Math.floor((Date.now() - t) / 86400000));
}

export function sauvegardeARappeler(donnees, derniere) {
  if (totalEnregistrements(donnees) === 0) return false;
  const j = joursDepuis(derniere);
  return j === null || j >= JOURS_AVANT_RAPPEL;
}

export function texteDerniereSauvegarde(derniere) {
  const j = joursDepuis(derniere);
  if (j === null) return "Jamais sauvegardé";
  if (j === 0) return "Sauvegardé aujourd'hui";
  if (j === 1) return "Sauvegardé hier";
  return `Sauvegardé il y a ${j} jours`;
}

/* ---------- Bandeau de rappel ---------- */
export function BandeauSauvegarde({ donnees, derniere, onSauvegarder }) {
  const [masque, setMasque] = useState(false);
  if (masque || !sauvegardeARappeler(donnees, derniere)) return null;
  const j = joursDepuis(derniere);
  return (
    <div className="bz-no-print mb-4 px-4 py-3 bg-[#FBF3E1] border border-[#B9832F] rounded-sm bz-sans text-sm flex flex-wrap items-center gap-3">
      <span className="text-[#6B4A12] flex-1 min-w-[200px]">
        {j === null
          ? "Vos données n'ont jamais été sauvegardées. Si ce téléphone est perdu ou le navigateur vidé, elles disparaissent."
          : `Dernière sauvegarde il y a ${j} jours. Pensez à en refaire une.`}
      </span>
      <button onClick={onSauvegarder} className="px-3 py-1.5 bg-[#1F6F5C] text-white rounded-sm font-medium">
        Sauvegarder maintenant
      </button>
      <button onClick={() => setMasque(true)} className="px-2 py-1.5 text-[#6B4A12] underline">
        Plus tard
      </button>
    </div>
  );
}

/* ---------- Page Sauvegarde & application ---------- */
export function SauvegardeView({ donnees, derniere, onSauvegarder, restaurer }) {
  const fichierRef = useRef(null);
  const [apercu, setApercu] = useState(null); // sauvegarde lue, en attente de confirmation
  const [message, setMessage] = useState(null); // { ton: "ok" | "erreur", texte }
  const [annulable, setAnnulable] = useState(null); // état d'avant la dernière restauration
  const [protection, setProtection] = useState(null); // true / false / null (inconnu)
  const [peutInstaller, setPeutInstaller] = useState(!!window.__bazinInstall);
  const installee =
    window.matchMedia?.("(display-mode: standalone)")?.matches || window.navigator.standalone === true;

  const total = totalEnregistrements(donnees);
  const tailleKo = useMemo(() => Math.round(JSON.stringify(construireSauvegarde(donnees).donnees).length / 1024), [donnees]);
  const peutPartager = typeof navigator !== "undefined" && typeof navigator.canShare === "function" && typeof File === "function";

  useEffect(() => {
    (async () => {
      try {
        const r = await window.storage.get(CLE_AVANT_RESTAURATION);
        if (r) setAnnulable(JSON.parse(r.value));
      } catch { /* pas d'état précédent */ }
      try {
        // Demande au navigateur de ne pas effacer les données tout seul quand la mémoire est pleine
        if (navigator.storage?.persist) {
          const deja = await navigator.storage.persisted();
          setProtection(deja || (await navigator.storage.persist()));
        }
      } catch { /* non disponible */ }
    })();
    const pret = () => setPeutInstaller(true);
    window.addEventListener("bazin-install-pret", pret);
    return () => window.removeEventListener("bazin-install-pret", pret);
  }, []);

  const installer = async () => {
    const evt = window.__bazinInstall;
    if (!evt) return;
    evt.prompt();
    try { await evt.userChoice; } catch { /* fermé */ }
    window.__bazinInstall = null;
    setPeutInstaller(false);
  };

  const partager = async () => {
    try {
      const sauvegarde = construireSauvegarde(donnees);
      const fichier = new File([JSON.stringify(sauvegarde)], nomFichier(), { type: "application/json" });
      if (!navigator.canShare({ files: [fichier] })) {
        setMessage({ ton: "erreur", texte: "Le partage de fichier n'est pas possible sur cet appareil. Utilisez « Télécharger la sauvegarde »." });
        return;
      }
      await navigator.share({ files: [fichier], title: "Sauvegarde Bazin" });
      onSauvegarder(sauvegarde.date);
      setMessage({ ton: "ok", texte: "Sauvegarde envoyée." });
    } catch (e) {
      if (e?.name !== "AbortError") {
        setMessage({ ton: "erreur", texte: "L'envoi n'a pas abouti. Utilisez « Télécharger la sauvegarde »." });
      }
    }
  };

  const lireFichier = (e) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    setMessage(null);
    const lecteur = new FileReader();
    lecteur.onerror = () => setMessage({ ton: "erreur", texte: "Impossible de lire ce fichier." });
    lecteur.onload = () => {
      let obj;
      try { obj = JSON.parse(String(lecteur.result)); } catch {
        setMessage({ ton: "erreur", texte: "Ce fichier n'est pas une sauvegarde Bazin." });
        return;
      }
      const r = validerSauvegarde(obj);
      if (!r.ok) { setMessage({ ton: "erreur", texte: r.erreur }); return; }
      setApercu({ nom: f.name, date: r.date, donnees: r.donnees });
    };
    lecteur.readAsText(f);
  };

  const confirmerRestauration = async () => {
    if (!apercu) return;
    // On garde l'état actuel pour pouvoir revenir en arrière
    const avant = construireSauvegarde(donnees);
    let garde = false;
    try {
      garde = !!(await window.storage.set(CLE_AVANT_RESTAURATION, JSON.stringify(avant)));
    } catch { garde = false; }
    if (!garde && total > 0) {
      // Pas assez de place pour garder l'ancien état dans le navigateur : on le télécharge
      telechargerJSON(nomFichier("bazin-avant-restauration"), avant);
    }
    restaurer(apercu.donnees);
    setAnnulable(garde ? avant : null);
    setApercu(null);
    setMessage({
      ton: "ok",
      texte: garde
        ? "Sauvegarde restaurée. Vous pouvez encore annuler ci-dessous si ce n'était pas le bon fichier."
        : "Sauvegarde restaurée. Vos anciennes données ont été téléchargées dans un fichier « bazin-avant-restauration ».",
    });
  };

  const annulerRestauration = async () => {
    if (!annulable) return;
    restaurer(annulable.donnees);
    try { await window.storage.delete(CLE_AVANT_RESTAURATION); } catch { /* sans gravité */ }
    setAnnulable(null);
    setMessage({ ton: "ok", texte: "Restauration annulée : vos données d'avant sont revenues." });
  };

  const carte = "bg-white border border-[#D8D2C2] rounded-sm p-5 mb-5";
  const btn = "px-4 py-2 rounded-sm bz-sans text-sm font-medium";

  return (
    <div className="max-w-3xl">
      <h1 className="bz-serif text-3xl font-semibold mb-1">Sauvegarde &amp; application</h1>
      <p className="bz-sans text-[#5B5F55] mb-6">
        Vos données sont enregistrées dans ce navigateur, sur cet appareil. Une sauvegarde les met à l'abri dans un fichier.
      </p>

      {message && (
        <div className={`mb-5 px-4 py-3 rounded-sm bz-sans text-sm border ${
          message.ton === "ok" ? "bg-[#E4F1EC] border-[#1F6F5C] text-[#17493D]" : "bg-[#F3E2D2] border-[#C1652F] text-[#8A3F14]"
        }`}>{message.texte}</div>
      )}

      {/* ---- Sauvegarder ---- */}
      <div className={carte}>
        <h2 className="bz-serif text-xl font-semibold mb-1">Sauvegarder</h2>
        <p className="bz-sans text-sm text-[#5B5F55] mb-4">
          {texteDerniereSauvegarde(derniere)}{derniere ? ` (${fmtDate(derniere)})` : ""} · {total} enregistrement{total > 1 ? "s" : ""} · {tailleKo} Ko
        </p>
        <div className="flex flex-wrap gap-3">
          <button disabled={total === 0} onClick={() => { onSauvegarder(telechargerSauvegarde(donnees)); setMessage({ ton: "ok", texte: "Sauvegarde téléchargée. Gardez ce fichier hors du téléphone (Google Drive, WhatsApp, e-mail)." }); }}
            className={`${btn} bg-[#1F6F5C] text-white disabled:opacity-40`}>
            Télécharger la sauvegarde
          </button>
          {peutPartager && (
            <button disabled={total === 0} onClick={partager} className={`${btn} border border-[#1F6F5C] text-[#1F6F5C] disabled:opacity-40`}>
              Envoyer (WhatsApp, Drive…)
            </button>
          )}
        </div>
        <p className="bz-sans text-xs text-[#9AA0A6] mt-3">
          Le fichier contient tous vos clients et vos montants : ne l'envoyez qu'à vous-même ou à une personne de confiance.
        </p>
      </div>

      {/* ---- Restaurer ---- */}
      <div className={carte}>
        <h2 className="bz-serif text-xl font-semibold mb-1">Restaurer</h2>
        <p className="bz-sans text-sm text-[#5B5F55] mb-4">
          Pour récupérer vos données sur un nouveau téléphone ou après un problème. La restauration remplace les données actuelles par celles du fichier.
        </p>
        <input ref={fichierRef} type="file" accept=".json,application/json" className="hidden" onChange={lireFichier} />
        {!apercu && (
          <button onClick={() => fichierRef.current?.click()} className={`${btn} border border-[#1B2430] text-[#1B2430]`}>
            Choisir un fichier de sauvegarde
          </button>
        )}
        {apercu && (
          <div className="border border-[#B9832F] bg-[#FBF3E1] rounded-sm p-4">
            <p className="bz-sans text-sm text-[#1B2430] mb-3">
              <b>{apercu.nom}</b>{apercu.date ? ` — sauvegarde du ${fmtDate(apercu.date)}` : ""}
            </p>
            <table className="w-full bz-sans text-sm mb-4">
              <thead>
                <tr className="text-left text-[#5B5F55]">
                  <th className="py-1 font-medium">Partie</th>
                  <th className="py-1 font-medium text-right">Dans le fichier</th>
                  <th className="py-1 font-medium text-right">Actuellement</th>
                </tr>
              </thead>
              <tbody>
                {CLES_DONNEES.filter(([nom]) => apercu.donnees[nom]).map(([nom, , libelle]) => (
                  <tr key={nom} className="border-t border-[#E7DFC9]">
                    <td className="py-1">{libelle}</td>
                    <td className="py-1 text-right bz-mono">{apercu.donnees[nom].length}</td>
                    <td className="py-1 text-right bz-mono text-[#9AA0A6]">{(donnees[nom] || []).length}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="flex flex-wrap gap-3">
              <button onClick={confirmerRestauration} className={`${btn} bg-[#B23A2E] text-white`}>
                Remplacer mes données par ce fichier
              </button>
              <button onClick={() => setApercu(null)} className={`${btn} border border-[#9AA0A6] text-[#5B5F55]`}>
                Annuler
              </button>
            </div>
          </div>
        )}
        {annulable && !apercu && (
          <div className="mt-4 pt-4 border-t border-[#E7DFC9]">
            <p className="bz-sans text-sm text-[#5B5F55] mb-2">
              Les données d'avant la dernière restauration ({fmtDate(annulable.date)}) sont encore gardées.
            </p>
            <button onClick={annulerRestauration} className={`${btn} border border-[#B23A2E] text-[#B23A2E]`}>
              Annuler la dernière restauration
            </button>
          </div>
        )}
      </div>

      {/* ---- Application ---- */}
      <div className={carte}>
        <h2 className="bz-serif text-xl font-semibold mb-1">Application sur le téléphone</h2>
        {installee ? (
          <p className="bz-sans text-sm text-[#17493D]">Bazin est installé sur cet appareil et s'ouvre même sans connexion.</p>
        ) : (
          <>
            <p className="bz-sans text-sm text-[#5B5F55] mb-4">
              Installez Bazin sur l'écran d'accueil : il s'ouvre comme une application, même sans connexion internet.
            </p>
            {peutInstaller ? (
              <button onClick={installer} className={`${btn} bg-[#1B2430] text-white`}>Installer l'application</button>
            ) : (
              <ul className="bz-sans text-sm text-[#1B2430] list-disc pl-5 space-y-1">
                <li><b>Android (Chrome)</b> : menu ⋮ puis « Ajouter à l'écran d'accueil » ou « Installer l'application ».</li>
                <li><b>iPhone (Safari)</b> : bouton Partager puis « Sur l'écran d'accueil ».</li>
              </ul>
            )}
          </>
        )}
        {protection !== null && (
          <p className="bz-sans text-xs text-[#9AA0A6] mt-4">
            {protection
              ? "Protection activée : le navigateur ne supprimera pas vos données tout seul pour libérer de la place."
              : "Le navigateur n'a pas accordé la protection contre l'effacement automatique. Installer l'application aide à l'obtenir ; la sauvegarde reste votre vraie sécurité."}
          </p>
        )}
      </div>
    </div>
  );
}

/* ============================================================
   Recherche globale
   ============================================================ */
export const normaliser = (s) =>
  String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const chiffres = (s) => String(s ?? "").replace(/\D/g, "");
const joindre = (...parts) => parts.filter((p) => p !== "" && p != null).join(" · ");

/* Décrit comment chercher et afficher chaque module.
   `terme` = le texte passé à la liste du module pour qu'elle s'ouvre déjà filtrée. */
function modulesRecherche(d) {
  const clientNom = (id) => (d.clients || []).find((c) => c.id === id)?.nom || "";
  const lignesTexte = (lignes) => (lignes || []).map((l) => l.description);
  const lignesTotal = (lignes) => (lignes || []).reduce((s, l) => s + nbr(l.quantite) * nbr(l.prixUnitaire), 0);
  return [
    {
      tab: "clients", label: "Clients", items: d.clients,
      champs: (c) => [c.nom, c.contact, c.email, c.adresse, c.notes], tel: (c) => c.telephone,
      titre: (c) => c.nom || "Client sans nom", detail: (c) => joindre(c.telephone, c.contact, c.adresse), terme: (c) => c.nom,
    },
    {
      tab: "ventes", label: "Ventes", items: d.ventes,
      champs: (v) => [v.client, v.article, v.qualite, v.modePaiement, v.notes, fmtDate(v.date)], tel: (v) => v.telephone,
      titre: (v) => joindre(v.client || "Client de passage", v.article || v.qualite),
      detail: (v) => {
        const total = nbr(v.metrage) * nbr(v.prixMetre) + nbr(v.transport);
        const reste = Math.max(0, total - nbr(v.montantPaye));
        return joindre(fmtDate(v.date), v.metrage ? `${v.metrage} m` : "", fcfa(total), reste > 0 ? `reste ${fcfa(reste)}` : "payé");
      },
      terme: (v) => v.client || v.article,
    },
    {
      tab: "commandes", label: "Commandes de bazins", items: d.commandes,
      champs: (c) => [c.client, c.typeCommande, c.qualiteDonnee, c.commandeChez, c.notes, fmtDate(c.date)], tel: (c) => c.telephone,
      titre: (c) => joindre(c.client || "Sans nom", c.typeCommande),
      detail: (c) => joindre(fmtDate(c.date), c.metrage ? `${c.metrage} m` : "", c.statut === "retiree" ? "retirée" : "à retirer"),
      terme: (c) => c.client,
    },
    {
      tab: "stock", label: "Stock", items: d.stock,
      champs: (s) => [s.nom],
      titre: (s) => s.nom || "Article sans nom", detail: (s) => joindre(`${nbr(s.quantite)} en stock`, fcfa(s.prixUnitaire)), terme: (s) => s.nom,
    },
    {
      tab: "caisse", label: "Caisse", items: d.caisse,
      champs: (t) => [t.numero, t.client, t.mode, t.notes, ...lignesTexte(t.lignes)], tel: (t) => t.telephone,
      titre: (t) => joindre(t.numero, t.client),
      detail: (t) => joindre(fmtDate(t.dateTime), fcfa(lignesTotal(t.lignes)), t.mode),
    },
    {
      tab: "docs", label: "Factures & devis", items: d.docs,
      champs: (x) => [x.numero, clientNom(x.clientId), ...lignesTexte(x.lignes)],
      titre: (x) => joindre(x.numero, clientNom(x.clientId)),
      detail: (x) => joindre(x.type === "facture" ? "Facture" : "Devis", fmtDate(x.date), fcfa(lignesTotal(x.lignes))),
    },
    {
      tab: "teintures", label: "Teinturiers", items: d.teintures,
      champs: (t) => [t.teinturier, t.qualite, t.couleur, t.notes],
      titre: (t) => joindre(t.teinturier || "Sans nom", t.couleur),
      detail: (t) => joindre(fmtDate(t.date), t.quantite ? `${t.quantite} × ${t.qualite || "bazin"}` : t.qualite, t.statut === "renvoye" ? "revenu" : "en teinture"),
      terme: (t) => (t.teinturier || "").trim(),
    },
    {
      tab: "production", label: "Teinture entreprise", items: d.productions,
      champs: (p) => [p.teinturier, p.qualite, p.couleur, p.notes],
      titre: (p) => joindre(p.qualite, p.couleur),
      detail: (p) => joindre(fmtDate(p.date), p.metrage ? `${p.metrage} m` : "", p.teinturier, p.statut === "termine" ? "terminé" : "en cours"),
      terme: (p) => p.couleur || p.teinturier || p.qualite,
    },
    {
      tab: "fournisseurs", label: "Fournisseurs", items: d.fournisseurs,
      champs: (f) => [f.nom, f.contact, f.email, f.adresse, f.notes], tel: (f) => f.telephone,
      titre: (f) => f.nom || "Fournisseur sans nom", detail: (f) => joindre(f.telephone, f.contact), terme: (f) => f.nom,
    },
    {
      tab: "depenses", label: "Dépenses", items: d.depenses,
      champs: (x) => [x.libelle, x.personne, x.notes],
      titre: (x) => x.libelle || "Dépense", detail: (x) => joindre(fmtDate(x.date), fcfa(x.montant), x.personne), terme: (x) => x.libelle || x.personne,
    },
  ];
}

const MAX_PAR_MODULE = 6;

/* Cherche `q` dans tous les modules. Tous les mots doivent être présents.
   Un numéro de téléphone se retrouve même tapé sans espaces ni indicatif. */
export function chercherPartout(donnees, q) {
  const mots = normaliser(q).split(/\s+/).filter(Boolean);
  if (mots.join("").length < 2) return [];
  const qChiffres = chiffres(q);
  const parTel = qChiffres.length >= 4 && /^[\d\s+().-]+$/.test(q.trim());
  const groupes = [];
  for (const m of modulesRecherche(donnees)) {
    const trouves = [];
    for (const item of m.items || []) {
      if (!item || typeof item !== "object") continue;
      const texte = normaliser([...m.champs(item), m.tel ? m.tel(item) : ""].join(" "));
      const ok = parTel && m.tel
        ? chiffres(m.tel(item)).includes(qChiffres)
        : mots.every((mot) => texte.includes(mot));
      if (ok) trouves.push(item);
    }
    if (trouves.length === 0) continue;
    groupes.push({
      tab: m.tab,
      label: m.label,
      total: trouves.length,
      items: trouves.slice(-MAX_PAR_MODULE).reverse().map((item) => ({
        id: item.id,
        titre: m.titre(item) || m.label,
        detail: m.detail(item),
        terme: m.terme ? String(m.terme(item) || "") : "",
      })),
    });
  }
  return groupes;
}

export function RechercheGlobale({ donnees, onOuvrir }) {
  const [q, setQ] = useState("");
  const groupes = useMemo(() => chercherPartout(donnees, q), [donnees, q]);
  const actif = normaliser(q).replace(/\s/g, "").length >= 2;
  const ouvrir = (tab, terme) => { setQ(""); onOuvrir(tab, terme); };

  return (
    <div className="bz-no-print mb-5">
      <div className="relative max-w-xl">
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Rechercher partout…"
          aria-label="Rechercher dans toute l'application"
          className="w-full border border-[#D8D2C2] bg-white rounded-sm px-3 py-2 bz-sans text-sm text-[#1B2430] focus:outline-none focus:ring-2 focus:ring-[#1F6F5C] focus:border-[#1F6F5C]"
        />
      </div>
      {actif && (
        <div className="mt-2 max-w-xl bg-white border border-[#D8D2C2] rounded-sm shadow-sm">
          {groupes.length === 0 && (
            <p className="px-4 py-3 bz-sans text-sm text-[#5B5F55]">Aucun résultat pour « {q.trim()} ».</p>
          )}
          {groupes.map((g) => (
            <div key={g.tab} className="border-b border-[#EFEADB] last:border-b-0">
              <button onClick={() => ouvrir(g.tab, "")}
                className="w-full flex items-center justify-between px-4 pt-3 pb-1 bz-sans text-xs uppercase tracking-widest text-[#B9832F] font-semibold">
                <span>{g.label}</span>
                <span className="bz-mono normal-case tracking-normal text-[#9AA0A6]">{g.total}</span>
              </button>
              {g.items.map((r) => (
                <button key={r.id} onClick={() => ouvrir(g.tab, r.terme)}
                  className="w-full text-left px-4 py-2 hover:bg-[#FBF9F4] focus:bg-[#FBF9F4] focus:outline-none">
                  <div className="bz-sans text-sm text-[#1B2430] font-medium">{r.titre}</div>
                  {r.detail && <div className="bz-sans text-xs text-[#5B5F55]">{r.detail}</div>}
                </button>
              ))}
              {g.total > g.items.length && (
                <button onClick={() => ouvrir(g.tab, "")} className="w-full text-left px-4 pb-3 pt-1 bz-sans text-xs text-[#1F6F5C] underline">
                  Voir les {g.total} résultats dans {g.label}
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
