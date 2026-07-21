import React, { useState, useEffect, useCallback, useMemo } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";

/* ---------- Utilitaires ---------- */
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const fcfa = (n) =>
  (Number(n) || 0).toLocaleString("fr-FR", {
    style: "currency",
    currency: "XOF",
    maximumFractionDigits: 0,
  });
const today = () => new Date().toISOString().slice(0, 10);
const fmtDate = (iso) => {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
};

/* Indicatif du pays par défaut, ajouté quand le numéro est saisi sans
   indicatif (ex. 77 123 45 67 → 221771234567). 221 = Sénégal. */
const INDICATIF_PAYS = "221";
const numeroWhatsApp = (tel) => {
  let d = String(tel || "").replace(/[^\d]/g, "");
  if (!d) return "";
  if (!d.startsWith(INDICATIF_PAYS) && d.length <= 9) d = INDICATIF_PAYS + d;
  return d;
};
const ouvrirWhatsApp = (tel, message) => {
  const num = numeroWhatsApp(tel);
  if (!num) {
    alert("Aucun numéro de téléphone enregistré pour ce client.");
    return;
  }
  window.open(`https://wa.me/${num}?text=${encodeURIComponent(message)}`, "_blank");
};
const moisLabel = (ym) => {
  const [y, m] = ym.split("-");
  const noms = ["Jan", "Fév", "Mar", "Avr", "Mai", "Juin", "Juil", "Août", "Sep", "Oct", "Nov", "Déc"];
  return `${noms[Number(m) - 1]} ${y.slice(2)}`;
};
function exportCSV(filename, rows, headers) {
  const escape = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const csv = [headers.map((h) => h.label).join(";"), ...rows.map((r) => headers.map((h) => escape(r[h.key])).join(";"))].join("\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/* ---------- Petit tampon (élément signature) ---------- */
function Tampon({ label, tone = "ink" }) {
  const tones = {
    ink: "border-[#1B2430] text-[#1B2430]",
    gold: "border-[#B9832F] text-[#B9832F]",
    fade: "border-[#9AA0A6] text-[#9AA0A6]",
  };
  return (
    <span
      className={`bz-tampon inline-block select-none border-2 rounded-full px-3 py-0.5 text-[11px] tracking-widest uppercase font-semibold ${tones[tone]}`}
    >
      {label}
    </span>
  );
}

/* ---------- Champ de formulaire ---------- */
function Field({ label, children }) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="text-[#5B5F55] font-medium">{label}</span>
      {children}
    </label>
  );
}
const inputCls =
  "border border-[#D8D2C2] bg-[#FBF9F4] rounded-sm px-3 py-2 text-[#1B2430] focus:outline-none focus:ring-2 focus:ring-[#1F6F5C] focus:border-[#1F6F5C]";

function SearchBox({ value, onChange, placeholder }) {
  return (
    <input
      className={`${inputCls} w-64`}
      placeholder={placeholder}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

/* ============================================================ */
export default function BazinApp() {
  const [tab, setTab] = useState("dashboard");
  const [loading, setLoading] = useState(true);
  const [saveError, setSaveError] = useState("");
  const [printingDoc, setPrintingDoc] = useState(null);

  const [clients, setClients] = useState([]);
  const [fournisseurs, setFournisseurs] = useState([]);
  const [stock, setStock] = useState([]);
  const [docs, setDocs] = useState([]);
  const [depenses, setDepenses] = useState([]);
  const [teintures, setTeintures] = useState([]);
  const [commandes, setCommandes] = useState([]);
  const [ventes, setVentes] = useState([]);
  const [caisse, setCaisse] = useState([]);
  const [productions, setProductions] = useState([]);

  /* ---- chargement initial ---- */
  useEffect(() => {
    (async () => {
      const load = async (key, fallback) => {
        try {
          const r = await window.storage.get(key, false);
          return r ? JSON.parse(r.value) : fallback;
        } catch {
          return fallback;
        }
      };
      const [c, f, s, d, dep, t, cmd, v, ca, prod] = await Promise.all([
        load("bazin:clients", []),
        load("bazin:fournisseurs", []),
        load("bazin:stock", []),
        load("bazin:documents", []),
        load("bazin:depenses", []),
        load("bazin:teintures", []),
        load("bazin:commandes", []),
        load("bazin:ventes", []),
        load("bazin:caisse", []),
        load("bazin:productions", []),
      ]);
      setClients(c);
      setFournisseurs(f);
      setStock(s);
      setDocs(d);
      setDepenses(dep);
      setTeintures(t);
      setCommandes(cmd);
      setVentes(v);
      setCaisse(ca);
      setProductions(prod);
      setLoading(false);
    })();
  }, []);

  const persist = useCallback(async (key, value) => {
    try {
      const r = await window.storage.set(key, JSON.stringify(value), false);
      if (!r) setSaveError("L'enregistrement a échoué. Réessayez.");
      else setSaveError("");
    } catch {
      setSaveError("L'enregistrement a échoué. Réessayez.");
    }
  }, []);

  const saveClients = (next) => { setClients(next); persist("bazin:clients", next); };
  const saveFournisseurs = (next) => { setFournisseurs(next); persist("bazin:fournisseurs", next); };
  const saveStock = (next) => { setStock(next); persist("bazin:stock", next); };
  const saveDocs = (next) => { setDocs(next); persist("bazin:documents", next); };
  const saveDepenses = (next) => { setDepenses(next); persist("bazin:depenses", next); };
  const saveTeintures = (next) => { setTeintures(next); persist("bazin:teintures", next); };
  const saveCommandes = (next) => { setCommandes(next); persist("bazin:commandes", next); };
  const saveVentes = (next) => { setVentes(next); persist("bazin:ventes", next); };
  const saveCaisse = (next) => { setCaisse(next); persist("bazin:caisse", next); };
  const saveProductions = (next) => { setProductions(next); persist("bazin:productions", next); };

  /* ---- dérivés ---- */
  const lowStock = stock.filter((s) => Number(s.quantite) <= Number(s.seuilAlerte));
  const totalDu = docs
    .filter((d) => d.type === "facture" && d.statut !== "payee")
    .reduce((sum, d) => sum + docLignesTotal(d), 0);
  const enRetard = docs.filter(
    (d) => d.type === "facture" && d.statut !== "payee" && d.echeance && d.echeance < today()
  );

  function docLignesTotal(d) {
    return d.lignes.reduce((s, l) => s + Number(l.quantite) * Number(l.prixUnitaire), 0);
  }

  const relancer = (doc) => {
    const client = clients.find((c) => c.id === doc.clientId);
    const next = docs.map((d) =>
      d.id === doc.id
        ? { ...d, relanceCount: (d.relanceCount || 0) + 1, derniereRelance: today() }
        : d
    );
    saveDocs(next);
    if (client?.email) {
      const sujet = encodeURIComponent(`Relance — Facture ${doc.numero}`);
      const corps = encodeURIComponent(
        `Bonjour${client.contact ? " " + client.contact : ""},\n\nSauf erreur de notre part, la facture ${doc.numero} du ${fmtDate(doc.date)} d'un montant de ${fcfa(docLignesTotal(doc))} reste impayée à ce jour.\n\nPourriez-vous nous indiquer où en est son règlement ?\n\nMerci d'avance,\nBazin`
      );
      window.open(`mailto:${client.email}?subject=${sujet}&body=${corps}`, "_blank");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F0EDE4]">
        <p className="font-serif text-[#1B2430] text-lg">Chargement de Bazin…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex bg-[#F0EDE4] text-[#1B2430]">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,600;9..144,700&family=Inter:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap');
        .bz-serif { font-family: 'Fraunces', serif; }
        .bz-sans { font-family: 'Inter', sans-serif; }
        .bz-mono { font-family: 'IBM Plex Mono', monospace; }
        .bz-tampon { transform: rotate(-3deg); }
        .bz-row:hover { background-color: #FBF9F4; }
        @media print {
          body * { visibility: hidden; }
          .bz-print-area, .bz-print-area * { visibility: visible; }
          .bz-print-area { position: absolute; top: 0; left: 0; width: 100%; }
          .bz-no-print { display: none !important; }
        }
      `}</style>

      {printingDoc && (
        <PrintView doc={printingDoc} clients={clients} onClose={() => setPrintingDoc(null)} />
      )}

      {/* ---------- Barre latérale ---------- */}
      <aside className="w-60 shrink-0 bg-[#1B2430] text-[#F0EDE4] flex flex-col">
        <div className="px-6 py-7 border-b border-white/10">
          <div className="bz-serif text-2xl font-semibold tracking-tight">Bazin</div>
          <div className="bz-mono text-[11px] text-[#9AA0A6] mt-1">Registre de gestion</div>
        </div>
        <nav className="flex-1 px-3 py-4 flex flex-col gap-1">
          {[
            ["dashboard", "Tableau de bord"],
            ["caisse", "Caisse"],
            ["rappels", "Rappels WhatsApp"],
            ["clients", "Clients"],
            ["fournisseurs", "Fournisseurs"],
            ["stock", "Stock"],
            ["docs", "Factures & devis"],
            ["depenses", "Dépenses"],
            ["teintures", "Teinturiers"],
            ["commandes", "Commandes de bazins"],
            ["production", "Teinture entreprise"],
            ["ventes", "Ventes"],
          ].map(([key, label]) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`text-left px-3 py-2 rounded-sm bz-sans text-sm transition-colors ${
                tab === key
                  ? "bg-[#F0EDE4] text-[#1B2430] font-semibold"
                  : "text-[#D8D2C2] hover:bg-white/5"
              }`}
            >
              {label}
            </button>
          ))}
        </nav>
        <div className="px-6 py-4 border-t border-white/10 text-[11px] text-[#9AA0A6] bz-sans">
          Données enregistrées localement
        </div>
      </aside>

      {/* ---------- Contenu ---------- */}
      <main className="flex-1 px-10 py-8 overflow-y-auto">
        {saveError && (
          <div className="mb-4 px-4 py-2 bg-[#F3E2D2] border border-[#C1652F] text-[#8A3F14] text-sm rounded-sm bz-sans">
            {saveError}
          </div>
        )}

        {tab === "dashboard" && (
          <Dashboard
            clients={clients}
            stock={stock}
            docs={docs}
            lowStock={lowStock}
            totalDu={totalDu}
            docLignesTotal={docLignesTotal}
            enRetard={enRetard}
            relancer={relancer}
          />
        )}
        {tab === "clients" && (
          <ClientsView clients={clients} saveClients={saveClients} docs={docs} />
        )}
        {tab === "fournisseurs" && (
          <FournisseursView fournisseurs={fournisseurs} saveFournisseurs={saveFournisseurs} stock={stock} />
        )}
        {tab === "stock" && <StockView stock={stock} saveStock={saveStock} fournisseurs={fournisseurs} />}
        {tab === "docs" && (
          <DocsView
            docs={docs}
            saveDocs={saveDocs}
            clients={clients}
            stock={stock}
            docLignesTotal={docLignesTotal}
            onPrint={setPrintingDoc}
            relancer={relancer}
          />
        )}
        {tab === "depenses" && (
          <DepensesView depenses={depenses} saveDepenses={saveDepenses} />
        )}
        {tab === "teintures" && (
          <TeinturesView teintures={teintures} saveTeintures={saveTeintures} />
        )}
        {tab === "commandes" && (
          <CommandesView commandes={commandes} saveCommandes={saveCommandes} />
        )}
        {tab === "ventes" && (
          <VentesView ventes={ventes} saveVentes={saveVentes} stock={stock} saveStock={saveStock} />
        )}
        {tab === "rappels" && (
          <RappelsView ventes={ventes} commandes={commandes} />
        )}
        {tab === "caisse" && (
          <CaisseView caisse={caisse} saveCaisse={saveCaisse} />
        )}
        {tab === "production" && (
          <ProductionView productions={productions} saveProductions={saveProductions} stock={stock} saveStock={saveStock} />
        )}
      </main>
    </div>
  );
}

/* ============================================================ */
function PrintView({ doc, clients, onClose }) {
  const client = clients.find((c) => c.id === doc.clientId);
  const total = doc.lignes.reduce((s, l) => s + Number(l.quantite) * Number(l.prixUnitaire), 0);
  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-start justify-center overflow-y-auto py-10">
      <div className="bz-no-print fixed top-4 right-4 flex gap-2">
        <button onClick={() => window.print()} className="bz-sans bg-[#1F6F5C] text-white px-4 py-2 rounded-sm text-sm">
          Imprimer / PDF
        </button>
        <button onClick={onClose} className="bz-sans bg-white px-4 py-2 rounded-sm text-sm border border-[#D8D2C2]">
          Fermer
        </button>
      </div>
      <div className="bz-print-area bg-white w-[210mm] min-h-[297mm] px-16 py-14 bz-sans text-[#1B2430]">
        <div className="flex justify-between items-start mb-12">
          <div>
            <div className="bz-serif text-3xl font-semibold">Bazin</div>
            <div className="text-xs text-[#9AA0A6] mt-1">Registre de gestion</div>
          </div>
          <div className="text-right">
            <div className="bz-serif text-xl font-semibold capitalize">{doc.type}</div>
            <div className="bz-mono text-sm">{doc.numero}</div>
            <div className="text-sm text-[#5B5F55] mt-1">{fmtDate(doc.date)}</div>
          </div>
        </div>

        <div className="mb-10">
          <div className="text-xs uppercase tracking-wide text-[#9AA0A6] mb-1">Destinataire</div>
          <div className="font-medium">{client?.nom || "—"}</div>
          {client?.contact && <div className="text-sm">{client.contact}</div>}
          {client?.adresse && <div className="text-sm">{client.adresse}</div>}
          {client?.email && <div className="text-sm">{client.email}</div>}
          {client?.telephone && <div className="text-sm">{client.telephone}</div>}
        </div>

        <table className="w-full text-sm mb-8">
          <thead>
            <tr className="text-left border-b-2 border-[#1B2430] text-xs uppercase tracking-wide">
              <th className="py-2">Description</th>
              <th className="py-2 text-right">Qté</th>
              <th className="py-2 text-right">P.U.</th>
              <th className="py-2 text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            {doc.lignes.map((l) => (
              <tr key={l.id} className="border-b border-[#EFEBDF]">
                <td className="py-2">{l.description}</td>
                <td className="py-2 text-right bz-mono">{l.quantite}</td>
                <td className="py-2 text-right bz-mono">{fcfa(l.prixUnitaire)}</td>
                <td className="py-2 text-right bz-mono">{fcfa(Number(l.quantite) * Number(l.prixUnitaire))}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="flex justify-end">
          <div className="w-64 flex justify-between border-t-2 border-[#1B2430] pt-2">
            <span className="bz-serif text-lg">Total</span>
            <span className="bz-mono text-lg font-medium">{fcfa(total)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}


function Dashboard({ clients, stock, docs, lowStock, totalDu, docLignesTotal, enRetard, relancer }) {
  const stats = [
    ["Clients", clients.length],
    ["Articles en stock", stock.length],
    ["Devis & factures", docs.length],
    ["Reste à encaisser", fcfa(totalDu)],
  ];

  const revenueByMonth = useMemo(() => {
    const map = {};
    docs
      .filter((d) => d.type === "facture" && d.statut === "payee")
      .forEach((d) => {
        const key = d.date.slice(0, 7);
        map[key] = (map[key] || 0) + docLignesTotal(d);
      });
    return Object.entries(map)
      .sort(([a], [b]) => (a < b ? -1 : 1))
      .slice(-6)
      .map(([mois, total]) => ({ mois: moisLabel(mois), total }));
  }, [docs, docLignesTotal]);

  return (
    <div>
      <h1 className="bz-serif text-3xl font-semibold mb-1">Tableau de bord</h1>
      <p className="bz-sans text-[#5B5F55] mb-8">Vue d'ensemble de l'activité de Bazin.</p>

      <div className="grid grid-cols-4 gap-4 mb-8">
        {stats.map(([label, value]) => (
          <div key={label} className="bg-white border border-[#D8D2C2] rounded-sm px-5 py-4">
            <div className="bz-sans text-xs uppercase tracking-wide text-[#9AA0A6] mb-1">
              {label}
            </div>
            <div className="bz-mono text-2xl font-medium">{value}</div>
          </div>
        ))}
      </div>

      {revenueByMonth.length > 0 && (
        <div className="bg-white border border-[#D8D2C2] rounded-sm p-5 mb-8">
          <h2 className="bz-serif text-lg font-semibold mb-4">Chiffre d'affaires encaissé (6 derniers mois)</h2>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={revenueByMonth}>
              <CartesianGrid strokeDasharray="3 3" stroke="#EFEBDF" />
              <XAxis dataKey="mois" tick={{ fontSize: 12, fontFamily: "Inter" }} stroke="#9AA0A6" />
              <YAxis tick={{ fontSize: 12, fontFamily: "Inter" }} stroke="#9AA0A6" width={70}
                tickFormatter={(v) => fcfa(v)} />
              <Tooltip formatter={(v) => fcfa(v)} contentStyle={{ fontFamily: "Inter", fontSize: 13 }} />
              <Bar dataKey="total" fill="#1F6F5C" radius={[2, 2, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {enRetard.length > 0 && (
        <div className="bg-white border border-[#C1652F] rounded-sm p-5 mb-8">
          <h2 className="bz-serif text-lg font-semibold mb-3 text-[#8A3F14]">
            Factures en retard — {enRetard.length}
          </h2>
          <ul className="flex flex-col gap-2">
            {enRetard.map((d) => (
              <li key={d.id} className="flex items-center justify-between text-sm bz-sans">
                <span>
                  {d.numero} — {clients.find((c) => c.id === d.clientId)?.nom || "Client supprimé"}
                  <span className="text-[#9AA0A6]"> · échéance {fmtDate(d.echeance)}</span>
                  {d.relanceCount > 0 && (
                    <span className="text-[#9AA0A6]"> · {d.relanceCount} relance(s), dernière le {fmtDate(d.derniereRelance)}</span>
                  )}
                </span>
                <span className="flex items-center gap-3">
                  <span className="bz-mono">{fcfa(docLignesTotal(d))}</span>
                  <button onClick={() => relancer(d)} className="text-[#1F6F5C] hover:underline whitespace-nowrap">
                    Relancer
                  </button>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="grid grid-cols-2 gap-6">
        <div className="bg-white border border-[#D8D2C2] rounded-sm p-5">
          <h2 className="bz-serif text-lg font-semibold mb-3">Stock à surveiller</h2>
          {lowStock.length === 0 ? (
            <p className="bz-sans text-sm text-[#9AA0A6]">
              Aucun article sous le seuil d'alerte.
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {lowStock.map((s) => (
                <li key={s.id} className="flex justify-between text-sm bz-sans">
                  <span>{s.nom}</span>
                  <span className="bz-mono text-[#C1652F]">
                    {s.quantite} / seuil {s.seuilAlerte}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="bg-white border border-[#D8D2C2] rounded-sm p-5">
          <h2 className="bz-serif text-lg font-semibold mb-3">Dernières factures & devis</h2>
          {docs.length === 0 ? (
            <p className="bz-sans text-sm text-[#9AA0A6]">Aucun document pour l'instant.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {[...docs]
                .sort((a, b) => (a.date < b.date ? 1 : -1))
                .slice(0, 5)
                .map((d) => (
                  <li key={d.id} className="flex justify-between text-sm bz-sans">
                    <span>
                      {d.numero} — {clients.find((c) => c.id === d.clientId)?.nom || "Client supprimé"}
                    </span>
                    <span className="bz-mono">{fcfa(docLignesTotal(d))}</span>
                  </li>
                ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

/* ============================================================ */
function ClientsView({ clients, saveClients, docs }) {
  const [editing, setEditing] = useState(null); // objet client ou null
  const [showForm, setShowForm] = useState(false);
  const [query, setQuery] = useState("");
  const empty = { id: "", nom: "", contact: "", telephone: "", email: "", adresse: "", notes: "" };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return clients;
    return clients.filter((c) =>
      [c.nom, c.contact, c.email, c.telephone].some((v) => (v || "").toLowerCase().includes(q))
    );
  }, [clients, query]);

  const exportClients = () =>
    exportCSV("bazin-clients.csv", clients, [
      { key: "nom", label: "Nom" },
      { key: "contact", label: "Contact" },
      { key: "telephone", label: "Téléphone" },
      { key: "email", label: "Email" },
      { key: "adresse", label: "Adresse" },
      { key: "notes", label: "Notes" },
    ]);

  const openNew = () => { setEditing({ ...empty, id: uid() }); setShowForm(true); };
  const openEdit = (c) => { setEditing(c); setShowForm(true); };

  const submit = (e) => {
    e.preventDefault();
    const exists = clients.some((c) => c.id === editing.id);
    saveClients(exists ? clients.map((c) => (c.id === editing.id ? editing : c)) : [...clients, editing]);
    setShowForm(false);
    setEditing(null);
  };

  const remove = (id) => {
    if (docs.some((d) => d.clientId === id)) {
      alert("Ce client a des devis/factures associés. Supprimez-les d'abord.");
      return;
    }
    saveClients(clients.filter((c) => c.id !== id));
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="bz-serif text-3xl font-semibold">Clients</h1>
          <p className="bz-sans text-[#5B5F55]">{clients.length} client(s) enregistré(s)</p>
        </div>
        <div className="flex gap-2 items-center">
          <SearchBox value={query} onChange={setQuery} placeholder="Rechercher un client…" />
          <button onClick={exportClients}
            className="bz-sans px-4 py-2 rounded-sm text-sm border border-[#D8D2C2] hover:bg-white">
            Exporter CSV
          </button>
          <button
            onClick={openNew}
            className="bz-sans bg-[#1F6F5C] text-white px-4 py-2 rounded-sm text-sm font-medium hover:bg-[#195A4A]"
          >
            + Nouveau client
          </button>
        </div>
      </div>

      {showForm && (
        <form onSubmit={submit} className="bg-white border border-[#D8D2C2] rounded-sm p-5 mb-6 grid grid-cols-2 gap-4">
          <Field label="Nom / raison sociale">
            <input required className={inputCls} value={editing.nom}
              onChange={(e) => setEditing({ ...editing, nom: e.target.value })} />
          </Field>
          <Field label="Personne à contacter">
            <input className={inputCls} value={editing.contact}
              onChange={(e) => setEditing({ ...editing, contact: e.target.value })} />
          </Field>
          <Field label="Téléphone">
            <input className={inputCls} value={editing.telephone}
              onChange={(e) => setEditing({ ...editing, telephone: e.target.value })} />
          </Field>
          <Field label="Email">
            <input type="email" className={inputCls} value={editing.email}
              onChange={(e) => setEditing({ ...editing, email: e.target.value })} />
          </Field>
          <Field label="Adresse">
            <input className={inputCls} value={editing.adresse}
              onChange={(e) => setEditing({ ...editing, adresse: e.target.value })} />
          </Field>
          <Field label="Notes">
            <input className={inputCls} value={editing.notes}
              onChange={(e) => setEditing({ ...editing, notes: e.target.value })} />
          </Field>
          <div className="col-span-2 flex gap-3 mt-1">
            <button type="submit" className="bz-sans bg-[#1B2430] text-white px-4 py-2 rounded-sm text-sm">
              Enregistrer
            </button>
            <button type="button" onClick={() => { setShowForm(false); setEditing(null); }}
              className="bz-sans px-4 py-2 rounded-sm text-sm border border-[#D8D2C2]">
              Annuler
            </button>
          </div>
        </form>
      )}

      <div className="bg-white border border-[#D8D2C2] rounded-sm overflow-hidden">
        {filtered.length === 0 ? (
          <p className="bz-sans text-sm text-[#9AA0A6] p-6">
            {clients.length === 0 ? "Aucun client. Ajoutez le premier avec le bouton ci-dessus." : "Aucun résultat pour cette recherche."}
          </p>
        ) : (
          <table className="w-full text-sm bz-sans">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-[#9AA0A6] border-b border-[#D8D2C2]">
                <th className="px-5 py-3">Nom</th>
                <th className="px-5 py-3">Contact</th>
                <th className="px-5 py-3">Téléphone</th>
                <th className="px-5 py-3">Email</th>
                <th className="px-5 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => (
                <tr key={c.id} className="bz-row border-b border-[#EFEBDF] last:border-0">
                  <td className="px-5 py-3 font-medium">{c.nom}</td>
                  <td className="px-5 py-3">{c.contact}</td>
                  <td className="px-5 py-3 bz-mono">{c.telephone}</td>
                  <td className="px-5 py-3">{c.email}</td>
                  <td className="px-5 py-3 text-right whitespace-nowrap">
                    <button onClick={() => openEdit(c)} className="text-[#1F6F5C] mr-3 hover:underline">Modifier</button>
                    <button onClick={() => remove(c.id)} className="text-[#C1652F] hover:underline">Supprimer</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

/* ============================================================ */
function FournisseursView({ fournisseurs, saveFournisseurs, stock }) {
  const [editing, setEditing] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [query, setQuery] = useState("");
  const empty = { id: "", nom: "", contact: "", telephone: "", email: "", adresse: "", notes: "" };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return fournisseurs;
    return fournisseurs.filter((f) =>
      [f.nom, f.contact, f.email, f.telephone].some((v) => (v || "").toLowerCase().includes(q))
    );
  }, [fournisseurs, query]);

  const exportFournisseurs = () =>
    exportCSV("bazin-fournisseurs.csv", fournisseurs, [
      { key: "nom", label: "Nom" },
      { key: "contact", label: "Contact" },
      { key: "telephone", label: "Téléphone" },
      { key: "email", label: "Email" },
      { key: "adresse", label: "Adresse" },
      { key: "notes", label: "Notes" },
    ]);

  const openNew = () => { setEditing({ ...empty, id: uid() }); setShowForm(true); };
  const openEdit = (f) => { setEditing(f); setShowForm(true); };

  const submit = (e) => {
    e.preventDefault();
    const exists = fournisseurs.some((f) => f.id === editing.id);
    saveFournisseurs(exists ? fournisseurs.map((f) => (f.id === editing.id ? editing : f)) : [...fournisseurs, editing]);
    setShowForm(false);
    setEditing(null);
  };

  const remove = (id) => {
    if (stock.some((s) => s.fournisseurId === id)) {
      alert("Des articles du stock sont liés à ce fournisseur. Modifiez-les d'abord.");
      return;
    }
    saveFournisseurs(fournisseurs.filter((f) => f.id !== id));
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="bz-serif text-3xl font-semibold">Fournisseurs</h1>
          <p className="bz-sans text-[#5B5F55]">{fournisseurs.length} fournisseur(s) enregistré(s)</p>
        </div>
        <div className="flex gap-2 items-center">
          <SearchBox value={query} onChange={setQuery} placeholder="Rechercher un fournisseur…" />
          <button onClick={exportFournisseurs}
            className="bz-sans px-4 py-2 rounded-sm text-sm border border-[#D8D2C2] hover:bg-white">
            Exporter CSV
          </button>
          <button onClick={openNew}
            className="bz-sans bg-[#1F6F5C] text-white px-4 py-2 rounded-sm text-sm font-medium hover:bg-[#195A4A]">
            + Nouveau fournisseur
          </button>
        </div>
      </div>

      {showForm && (
        <form onSubmit={submit} className="bg-white border border-[#D8D2C2] rounded-sm p-5 mb-6 grid grid-cols-2 gap-4">
          <Field label="Nom / raison sociale">
            <input required className={inputCls} value={editing.nom}
              onChange={(e) => setEditing({ ...editing, nom: e.target.value })} />
          </Field>
          <Field label="Personne à contacter">
            <input className={inputCls} value={editing.contact}
              onChange={(e) => setEditing({ ...editing, contact: e.target.value })} />
          </Field>
          <Field label="Téléphone">
            <input className={inputCls} value={editing.telephone}
              onChange={(e) => setEditing({ ...editing, telephone: e.target.value })} />
          </Field>
          <Field label="Email">
            <input type="email" className={inputCls} value={editing.email}
              onChange={(e) => setEditing({ ...editing, email: e.target.value })} />
          </Field>
          <Field label="Adresse">
            <input className={inputCls} value={editing.adresse}
              onChange={(e) => setEditing({ ...editing, adresse: e.target.value })} />
          </Field>
          <Field label="Notes">
            <input className={inputCls} value={editing.notes}
              onChange={(e) => setEditing({ ...editing, notes: e.target.value })} />
          </Field>
          <div className="col-span-2 flex gap-3 mt-1">
            <button type="submit" className="bz-sans bg-[#1B2430] text-white px-4 py-2 rounded-sm text-sm">
              Enregistrer
            </button>
            <button type="button" onClick={() => { setShowForm(false); setEditing(null); }}
              className="bz-sans px-4 py-2 rounded-sm text-sm border border-[#D8D2C2]">
              Annuler
            </button>
          </div>
        </form>
      )}

      <div className="bg-white border border-[#D8D2C2] rounded-sm overflow-hidden">
        {filtered.length === 0 ? (
          <p className="bz-sans text-sm text-[#9AA0A6] p-6">
            {fournisseurs.length === 0 ? "Aucun fournisseur. Ajoutez le premier avec le bouton ci-dessus." : "Aucun résultat pour cette recherche."}
          </p>
        ) : (
          <table className="w-full text-sm bz-sans">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-[#9AA0A6] border-b border-[#D8D2C2]">
                <th className="px-5 py-3">Nom</th>
                <th className="px-5 py-3">Contact</th>
                <th className="px-5 py-3">Téléphone</th>
                <th className="px-5 py-3">Email</th>
                <th className="px-5 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((f) => (
                <tr key={f.id} className="bz-row border-b border-[#EFEBDF] last:border-0">
                  <td className="px-5 py-3 font-medium">{f.nom}</td>
                  <td className="px-5 py-3">{f.contact}</td>
                  <td className="px-5 py-3 bz-mono">{f.telephone}</td>
                  <td className="px-5 py-3">{f.email}</td>
                  <td className="px-5 py-3 text-right whitespace-nowrap">
                    <button onClick={() => openEdit(f)} className="text-[#1F6F5C] mr-3 hover:underline">Modifier</button>
                    <button onClick={() => remove(f.id)} className="text-[#C1652F] hover:underline">Supprimer</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

/* ============================================================ */
function StockView({ stock, saveStock, fournisseurs }) {
  const [editing, setEditing] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [query, setQuery] = useState("");
  const empty = { id: "", nom: "", quantite: 0, prixUnitaire: 0, seuilAlerte: 0, fournisseurId: "" };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return stock;
    return stock.filter((s) => (s.nom || "").toLowerCase().includes(q));
  }, [stock, query]);

  const exportStock = () =>
    exportCSV("bazin-stock.csv", stock, [
      { key: "nom", label: "Article" },
      { key: "prixUnitaire", label: "Prix unitaire" },
      { key: "quantite", label: "Quantité" },
      { key: "seuilAlerte", label: "Seuil d'alerte" },
    ]);

  const openNew = () => { setEditing({ ...empty, id: uid() }); setShowForm(true); };
  const openEdit = (s) => { setEditing(s); setShowForm(true); };

  const submit = (e) => {
    e.preventDefault();
    const exists = stock.some((s) => s.id === editing.id);
    saveStock(exists ? stock.map((s) => (s.id === editing.id ? editing : s)) : [...stock, editing]);
    setShowForm(false);
    setEditing(null);
  };

  const remove = (id) => saveStock(stock.filter((s) => s.id !== id));

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="bz-serif text-3xl font-semibold">Stock</h1>
          <p className="bz-sans text-[#5B5F55]">{stock.length} article(s) référencé(s)</p>
        </div>
        <div className="flex gap-2 items-center">
          <SearchBox value={query} onChange={setQuery} placeholder="Rechercher un article…" />
          <button onClick={exportStock}
            className="bz-sans px-4 py-2 rounded-sm text-sm border border-[#D8D2C2] hover:bg-white">
            Exporter CSV
          </button>
          <button onClick={openNew}
            className="bz-sans bg-[#1F6F5C] text-white px-4 py-2 rounded-sm text-sm font-medium hover:bg-[#195A4A]">
            + Nouvel article
          </button>
        </div>
      </div>

      {showForm && (
        <form onSubmit={submit} className="bg-white border border-[#D8D2C2] rounded-sm p-5 mb-6 grid grid-cols-2 gap-4">
          <Field label="Nom de l'article">
            <input required className={inputCls} value={editing.nom}
              onChange={(e) => setEditing({ ...editing, nom: e.target.value })} />
          </Field>
          <Field label="Prix unitaire (F CFA)">
            <input type="number" step="1" min="0" className={inputCls} value={editing.prixUnitaire}
              onChange={(e) => setEditing({ ...editing, prixUnitaire: e.target.value })} />
          </Field>
          <Field label="Quantité en stock">
            <input type="number" min="0" className={inputCls} value={editing.quantite}
              onChange={(e) => setEditing({ ...editing, quantite: e.target.value })} />
          </Field>
          <Field label="Seuil d'alerte">
            <input type="number" min="0" className={inputCls} value={editing.seuilAlerte}
              onChange={(e) => setEditing({ ...editing, seuilAlerte: e.target.value })} />
          </Field>
          <Field label="Fournisseur">
            <select className={inputCls} value={editing.fournisseurId || ""}
              onChange={(e) => setEditing({ ...editing, fournisseurId: e.target.value })}>
              <option value="">— aucun —</option>
              {fournisseurs.map((f) => <option key={f.id} value={f.id}>{f.nom}</option>)}
            </select>
          </Field>
          <div className="col-span-2 flex gap-3 mt-1">
            <button type="submit" className="bz-sans bg-[#1B2430] text-white px-4 py-2 rounded-sm text-sm">
              Enregistrer
            </button>
            <button type="button" onClick={() => { setShowForm(false); setEditing(null); }}
              className="bz-sans px-4 py-2 rounded-sm text-sm border border-[#D8D2C2]">
              Annuler
            </button>
          </div>
        </form>
      )}

      <div className="bg-white border border-[#D8D2C2] rounded-sm overflow-hidden">
        {filtered.length === 0 ? (
          <p className="bz-sans text-sm text-[#9AA0A6] p-6">
            {stock.length === 0 ? "Aucun article. Ajoutez-en un ci-dessus." : "Aucun résultat pour cette recherche."}
          </p>
        ) : (
          <table className="w-full text-sm bz-sans">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-[#9AA0A6] border-b border-[#D8D2C2]">
                <th className="px-5 py-3">Article</th>
                <th className="px-5 py-3">Prix unitaire</th>
                <th className="px-5 py-3">Quantité</th>
                <th className="px-5 py-3">Seuil</th>
                <th className="px-5 py-3">Fournisseur</th>
                <th className="px-5 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((s) => {
                const low = Number(s.quantite) <= Number(s.seuilAlerte);
                return (
                  <tr key={s.id} className="bz-row border-b border-[#EFEBDF] last:border-0">
                    <td className="px-5 py-3 font-medium">{s.nom}</td>
                    <td className="px-5 py-3 bz-mono">{fcfa(s.prixUnitaire)}</td>
                    <td className="px-5 py-3 bz-mono">
                      {s.quantite}
                      {low && <Tampon label="Bas" tone="gold" />}
                    </td>
                    <td className="px-5 py-3 bz-mono text-[#9AA0A6]">{s.seuilAlerte}</td>
                    <td className="px-5 py-3 text-[#5B5F55]">{fournisseurs.find((f) => f.id === s.fournisseurId)?.nom || "—"}</td>
                    <td className="px-5 py-3 text-right whitespace-nowrap">
                      <button onClick={() => openEdit(s)} className="text-[#1F6F5C] mr-3 hover:underline">Modifier</button>
                      <button onClick={() => remove(s.id)} className="text-[#C1652F] hover:underline">Supprimer</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

/* ============================================================ */
function DocsView({ docs, saveDocs, clients, stock, docLignesTotal, onPrint, relancer }) {
  const [editing, setEditing] = useState(null);
  const [showForm, setShowForm] = useState(false);

  const nextNumero = (type) => {
    const prefix = type === "devis" ? "D" : "F";
    const year = new Date().getFullYear();
    const count = docs.filter((d) => d.type === type).length + 1;
    return `${prefix}-${year}-${String(count).padStart(3, "0")}`;
  };

  const emptyDoc = (type = "devis") => ({
    id: uid(),
    type,
    numero: nextNumero(type),
    clientId: clients[0]?.id || "",
    date: today(),
    echeance: "",
    statut: "en_attente",
    relanceCount: 0,
    derniereRelance: "",
    lignes: [{ id: uid(), description: "", quantite: 1, prixUnitaire: 0 }],
  });

  const openNew = (type) => { setEditing(emptyDoc(type)); setShowForm(true); };
  const openEdit = (d) => { setEditing(d); setShowForm(true); };
  const remove = (id) => saveDocs(docs.filter((d) => d.id !== id));

  const submit = (e) => {
    e.preventDefault();
    if (!editing.clientId) { alert("Ajoutez d'abord un client."); return; }
    const exists = docs.some((d) => d.id === editing.id);
    saveDocs(exists ? docs.map((d) => (d.id === editing.id ? editing : d)) : [...docs, editing]);
    setShowForm(false);
    setEditing(null);
  };

  const updateLigne = (idx, patch) => {
    const lignes = editing.lignes.map((l, i) => (i === idx ? { ...l, ...patch } : l));
    setEditing({ ...editing, lignes });
  };
  const addLigne = () =>
    setEditing({ ...editing, lignes: [...editing.lignes, { id: uid(), description: "", quantite: 1, prixUnitaire: 0 }] });
  const removeLigne = (idx) =>
    setEditing({ ...editing, lignes: editing.lignes.filter((_, i) => i !== idx) });

  const pickStock = (idx, stockId) => {
    const item = stock.find((s) => s.id === stockId);
    if (!item) return;
    updateLigne(idx, { description: item.nom, prixUnitaire: item.prixUnitaire });
  };

  const statutTone = { en_attente: "fade", envoye: "gold", payee: "ink" };
  const statutLabel = { en_attente: "En attente", envoye: "Envoyé", payee: "Payé" };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="bz-serif text-3xl font-semibold">Factures & devis</h1>
          <p className="bz-sans text-[#5B5F55]">{docs.length} document(s)</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => openNew("devis")}
            className="bz-sans border border-[#1B2430] text-[#1B2430] px-4 py-2 rounded-sm text-sm font-medium hover:bg-[#1B2430] hover:text-white">
            + Nouveau devis
          </button>
          <button onClick={() => openNew("facture")}
            className="bz-sans bg-[#1F6F5C] text-white px-4 py-2 rounded-sm text-sm font-medium hover:bg-[#195A4A]">
            + Nouvelle facture
          </button>
        </div>
      </div>

      {showForm && (
        <form onSubmit={submit} className="bg-white border border-[#D8D2C2] rounded-sm p-5 mb-6">
          <div className="grid grid-cols-2 gap-4 mb-4">
            <Field label="Numéro">
              <input className={`${inputCls} bz-mono`} value={editing.numero}
                onChange={(e) => setEditing({ ...editing, numero: e.target.value })} />
            </Field>
            <Field label="Client">
              <select required className={inputCls} value={editing.clientId}
                onChange={(e) => setEditing({ ...editing, clientId: e.target.value })}>
                <option value="">— choisir —</option>
                {clients.map((c) => <option key={c.id} value={c.id}>{c.nom}</option>)}
              </select>
            </Field>
          </div>

          <div className="grid grid-cols-3 gap-4 mb-4">
            <Field label="Date">
              <input type="date" className={inputCls} value={editing.date}
                onChange={(e) => setEditing({ ...editing, date: e.target.value })} />
            </Field>
            <Field label="Échéance">
              <input type="date" className={inputCls} value={editing.echeance || ""}
                onChange={(e) => setEditing({ ...editing, echeance: e.target.value })} />
            </Field>
            <Field label="Statut">
              <select className={inputCls} value={editing.statut}
                onChange={(e) => setEditing({ ...editing, statut: e.target.value })}>
                <option value="en_attente">En attente</option>
                <option value="envoye">Envoyé</option>
                <option value="payee">Payé</option>
              </select>
            </Field>
          </div>

          <div className="mt-5">
            <div className="text-sm font-medium text-[#5B5F55] mb-2">Lignes</div>
            <div className="flex flex-col gap-2">
              {editing.lignes.map((l, idx) => (
                <div key={l.id} className="grid grid-cols-12 gap-2 items-end">
                  <div className="col-span-4">
                    <select className={inputCls + " w-full"} defaultValue=""
                      onChange={(e) => pickStock(idx, e.target.value)}>
                      <option value="">Depuis le stock…</option>
                      {stock.map((s) => <option key={s.id} value={s.id}>{s.nom}</option>)}
                    </select>
                  </div>
                  <div className="col-span-4">
                    <input placeholder="Description" className={inputCls + " w-full"} value={l.description}
                      onChange={(e) => updateLigne(idx, { description: e.target.value })} />
                  </div>
                  <div className="col-span-2">
                    <input type="number" min="0" step="1" placeholder="Qté" className={inputCls + " w-full"} value={l.quantite}
                      onChange={(e) => updateLigne(idx, { quantite: e.target.value })} />
                  </div>
                  <div className="col-span-1">
                    <input type="number" min="0" step="1" placeholder="P.U." className={inputCls + " w-full"} value={l.prixUnitaire}
                      onChange={(e) => updateLigne(idx, { prixUnitaire: e.target.value })} />
                  </div>
                  <div className="col-span-1 text-right">
                    <button type="button" onClick={() => removeLigne(idx)} className="text-[#C1652F] text-sm hover:underline">✕</button>
                  </div>
                </div>
              ))}
            </div>
            <button type="button" onClick={addLigne} className="bz-sans text-sm text-[#1F6F5C] mt-2 hover:underline">
              + Ajouter une ligne
            </button>
          </div>

          <div className="flex justify-between items-center mt-6 pt-4 border-t border-[#EFEBDF]">
            <div className="bz-serif text-xl">
              Total : <span className="bz-mono">{fcfa(docLignesTotal(editing))}</span>
            </div>
            <div className="flex gap-3">
              <button type="submit" className="bz-sans bg-[#1B2430] text-white px-4 py-2 rounded-sm text-sm">
                Enregistrer
              </button>
              <button type="button" onClick={() => { setShowForm(false); setEditing(null); }}
                className="bz-sans px-4 py-2 rounded-sm text-sm border border-[#D8D2C2]">
                Annuler
              </button>
            </div>
          </div>
        </form>
      )}

      <div className="bg-white border border-[#D8D2C2] rounded-sm overflow-hidden">
        {docs.length === 0 ? (
          <p className="bz-sans text-sm text-[#9AA0A6] p-6">Aucun document pour l'instant.</p>
        ) : (
          <table className="w-full text-sm bz-sans">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-[#9AA0A6] border-b border-[#D8D2C2]">
                <th className="px-5 py-3">N°</th>
                <th className="px-5 py-3">Type</th>
                <th className="px-5 py-3">Client</th>
                <th className="px-5 py-3">Date</th>
                <th className="px-5 py-3">Échéance</th>
                <th className="px-5 py-3">Montant</th>
                <th className="px-5 py-3">Statut</th>
                <th className="px-5 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {[...docs].sort((a, b) => (a.date < b.date ? 1 : -1)).map((d) => {
                const enRetard = d.type === "facture" && d.statut !== "payee" && d.echeance && d.echeance < today();
                return (
                <tr key={d.id} className="bz-row border-b border-[#EFEBDF] last:border-0">
                  <td className="px-5 py-3 bz-mono font-medium">{d.numero}</td>
                  <td className="px-5 py-3 capitalize">{d.type}</td>
                  <td className="px-5 py-3">{clients.find((c) => c.id === d.clientId)?.nom || "—"}</td>
                  <td className="px-5 py-3 bz-mono">{fmtDate(d.date)}</td>
                  <td className={`px-5 py-3 bz-mono ${enRetard ? "text-[#C1652F] font-medium" : ""}`}>{fmtDate(d.echeance)}</td>
                  <td className="px-5 py-3 bz-mono">{fcfa(docLignesTotal(d))}</td>
                  <td className="px-5 py-3"><Tampon label={statutLabel[d.statut]} tone={statutTone[d.statut]} /></td>
                  <td className="px-5 py-3 text-right whitespace-nowrap">
                    {enRetard && (
                      <button onClick={() => relancer(d)} className="text-[#C1652F] mr-3 hover:underline">Relancer</button>
                    )}
                    <button onClick={() => onPrint(d)} className="text-[#1B2430] mr-3 hover:underline">Imprimer</button>
                    <button onClick={() => openEdit(d)} className="text-[#1F6F5C] mr-3 hover:underline">Modifier</button>
                    <button onClick={() => remove(d.id)} className="text-[#C1652F] hover:underline">Supprimer</button>
                  </td>
                </tr>
              );})}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

/* ============================================================ */
function DepensesView({ depenses, saveDepenses }) {
  const [editing, setEditing] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [query, setQuery] = useState("");
  const empty = { id: "", personne: "", libelle: "", montant: 0, date: today(), notes: "" };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return depenses;
    return depenses.filter((d) =>
      [d.personne, d.libelle, d.notes].some((v) => (v || "").toLowerCase().includes(q))
    );
  }, [depenses, query]);

  const totalFiltre = filtered.reduce((s, d) => s + Number(d.montant), 0);

  const exportDepenses = () =>
    exportCSV("bazin-depenses.csv", depenses, [
      { key: "date", label: "Date" },
      { key: "personne", label: "Personne" },
      { key: "libelle", label: "Dépense" },
      { key: "montant", label: "Montant (F CFA)" },
      { key: "notes", label: "Notes" },
    ]);

  const openNew = () => { setEditing({ ...empty, id: uid() }); setShowForm(true); };
  const openEdit = (d) => { setEditing(d); setShowForm(true); };

  const submit = (e) => {
    e.preventDefault();
    const exists = depenses.some((d) => d.id === editing.id);
    saveDepenses(exists ? depenses.map((d) => (d.id === editing.id ? editing : d)) : [...depenses, editing]);
    setShowForm(false);
    setEditing(null);
  };

  const remove = (id) => saveDepenses(depenses.filter((d) => d.id !== id));

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="bz-serif text-3xl font-semibold">Dépenses</h1>
          <p className="bz-sans text-[#5B5F55]">
            {depenses.length} dépense(s) · total affiché : <span className="bz-mono">{fcfa(totalFiltre)}</span>
          </p>
        </div>
        <div className="flex gap-2 items-center">
          <SearchBox value={query} onChange={setQuery} placeholder="Rechercher une dépense…" />
          <button onClick={exportDepenses}
            className="bz-sans px-4 py-2 rounded-sm text-sm border border-[#D8D2C2] hover:bg-white">
            Exporter CSV
          </button>
          <button onClick={openNew}
            className="bz-sans bg-[#1F6F5C] text-white px-4 py-2 rounded-sm text-sm font-medium hover:bg-[#195A4A]">
            + Nouvelle dépense
          </button>
        </div>
      </div>

      {showForm && (
        <form onSubmit={submit} className="bg-white border border-[#D8D2C2] rounded-sm p-5 mb-6 grid grid-cols-2 gap-4">
          <Field label="Nom de la personne">
            <input required className={inputCls} value={editing.personne}
              onChange={(e) => setEditing({ ...editing, personne: e.target.value })} />
          </Field>
          <Field label="Dépense (quoi ?)">
            <input required className={inputCls} value={editing.libelle}
              onChange={(e) => setEditing({ ...editing, libelle: e.target.value })} />
          </Field>
          <Field label="Montant (F CFA)">
            <input type="number" min="0" step="1" required className={inputCls} value={editing.montant}
              onChange={(e) => setEditing({ ...editing, montant: e.target.value })} />
          </Field>
          <Field label="Date">
            <input type="date" required className={inputCls} value={editing.date}
              onChange={(e) => setEditing({ ...editing, date: e.target.value })} />
          </Field>
          <Field label="Notes">
            <input className={inputCls} value={editing.notes}
              onChange={(e) => setEditing({ ...editing, notes: e.target.value })} />
          </Field>
          <div className="col-span-2 flex gap-3 mt-1">
            <button type="submit" className="bz-sans bg-[#1B2430] text-white px-4 py-2 rounded-sm text-sm">
              Enregistrer
            </button>
            <button type="button" onClick={() => { setShowForm(false); setEditing(null); }}
              className="bz-sans px-4 py-2 rounded-sm text-sm border border-[#D8D2C2]">
              Annuler
            </button>
          </div>
        </form>
      )}

      <div className="bg-white border border-[#D8D2C2] rounded-sm overflow-hidden">
        {filtered.length === 0 ? (
          <p className="bz-sans text-sm text-[#9AA0A6] p-6">
            {depenses.length === 0 ? "Aucune dépense. Ajoutez la première avec le bouton ci-dessus." : "Aucun résultat pour cette recherche."}
          </p>
        ) : (
          <table className="w-full text-sm bz-sans">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-[#9AA0A6] border-b border-[#D8D2C2]">
                <th className="px-5 py-3">Date</th>
                <th className="px-5 py-3">Personne</th>
                <th className="px-5 py-3">Dépense</th>
                <th className="px-5 py-3">Montant</th>
                <th className="px-5 py-3">Notes</th>
                <th className="px-5 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {[...filtered].sort((a, b) => (a.date < b.date ? 1 : -1)).map((d) => (
                <tr key={d.id} className="bz-row border-b border-[#EFEBDF] last:border-0">
                  <td className="px-5 py-3 bz-mono">{fmtDate(d.date)}</td>
                  <td className="px-5 py-3 font-medium">{d.personne}</td>
                  <td className="px-5 py-3">{d.libelle}</td>
                  <td className="px-5 py-3 bz-mono">{fcfa(d.montant)}</td>
                  <td className="px-5 py-3 text-[#5B5F55]">{d.notes}</td>
                  <td className="px-5 py-3 text-right whitespace-nowrap">
                    <button onClick={() => openEdit(d)} className="text-[#1F6F5C] mr-3 hover:underline">Modifier</button>
                    <button onClick={() => remove(d.id)} className="text-[#C1652F] hover:underline">Supprimer</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

/* ============================================================ */
function TeinturesView({ teintures, saveTeintures }) {
  const [query, setQuery] = useState("");
  const [selection, setSelection] = useState(null); // nom du teinturier ouvert
  const [showNew, setShowNew] = useState(false);
  const [newName, setNewName] = useState("");

  const qualites = ["Vainqueur blanc", "Moins riche", "Riche", "Habillement homme", "Habillement femme"];

  const cellText = "w-full bg-transparent px-2 py-1.5 text-sm text-[#1B2430] border border-transparent rounded-sm focus:outline-none focus:border-[#1F6F5C] focus:bg-white";
  const cellSelect = cellText + " cursor-pointer";

  const nomDe = (t) => (t.teinturier || "").trim() || "Sans nom";

  const teinturiers = useMemo(() => {
    const map = new Map();
    teintures.forEach((t) => {
      const nom = nomDe(t);
      if (!map.has(nom)) map.set(nom, { nom, nb: 0, enTeinture: 0, total: 0 });
      const e = map.get(nom);
      e.nb += 1;
      e.total += Number(t.prix) || 0;
      if (t.statut !== "renvoye") e.enTeinture += 1;
    });
    return [...map.values()].sort((a, b) => a.nom.localeCompare(b.nom));
  }, [teintures]);

  const teinturiersAffiches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return teinturiers;
    return teinturiers.filter((t) => t.nom.toLowerCase().includes(q));
  }, [teinturiers, query]);

  const fiche = selection ? teinturiers.find((t) => t.nom === selection) : null;
  const lignes = selection ? teintures.filter((t) => nomDe(t) === selection) : [];

  const update = (id, patch) =>
    saveTeintures(teintures.map((t) => (t.id === id ? { ...t, ...patch } : t)));

  const addRow = (nomTeinturier) =>
    saveTeintures([
      ...teintures,
      { id: uid(), date: today(), teinturier: nomTeinturier, lancePar: "", qualite: qualites[0], quantite: "", prix: "", statut: "en_teinture", notes: "" },
    ]);

  const remove = (id) => saveTeintures(teintures.filter((t) => t.id !== id));

  const creerTeinturier = (e) => {
    e.preventDefault();
    const nom = newName.trim();
    if (!nom) return;
    addRow(nom);
    setSelection(nom);
    setShowNew(false);
    setNewName("");
  };

  const exportTeintures = (rows, nomFichier) =>
    exportCSV(
      nomFichier,
      rows.map((t) => ({ ...t, statut: t.statut === "renvoye" ? "Oui" : "Non" })),
      [
        { key: "date", label: "Date" },
        { key: "teinturier", label: "Teinturier" },
        { key: "lancePar", label: "Commande lancée par" },
        { key: "qualite", label: "Qualité de bazin" },
        { key: "quantite", label: "Quantité" },
        { key: "prix", label: "Prix teinture (F CFA)" },
        { key: "statut", label: "Bazin renvoyé" },
        { key: "notes", label: "Notes" },
      ]
    );

  /* ---- Partie d'un teinturier : tableau modèle Excel ---- */
  if (selection) {
    const parQualite = qualites
      .map((q) => ({
        qualite: q,
        total: lignes.filter((t) => t.qualite === q).reduce((s, t) => s + (Number(t.quantite) || 0), 0),
      }))
      .filter((e) => e.total > 0);
    return (
      <div>
        <button onClick={() => setSelection(null)}
          className="bz-sans text-sm text-[#1F6F5C] mb-4 hover:underline">
          ← Tous les teinturiers
        </button>
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="bz-serif text-3xl font-semibold">{selection}</h1>
            <p className="bz-sans text-[#5B5F55]">
              {fiche ? `${fiche.nb} ligne(s) · ${fiche.enTeinture} bazin(s) encore en teinture · total : ` : ""}
              {fiche && <span className="bz-mono">{fcfa(fiche.total)}</span>}
            </p>
          </div>
          <div className="flex gap-2 items-center">
            <button onClick={() => exportTeintures(lignes, `bazin-teinture-${selection}.csv`)}
              className="bz-sans px-4 py-2 rounded-sm text-sm border border-[#D8D2C2] hover:bg-white">
              Exporter CSV
            </button>
            <button onClick={() => addRow(selection)}
              className="bz-sans bg-[#1F6F5C] text-white px-4 py-2 rounded-sm text-sm font-medium hover:bg-[#195A4A]">
              + Ajouter une ligne
            </button>
          </div>
        </div>

        {parQualite.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-4">
            {parQualite.map((e) => (
              <span key={e.qualite}
                className="bz-sans text-sm bg-white border border-[#D8D2C2] rounded-sm px-3 py-1.5">
                {e.qualite} : <span className="bz-mono font-medium">{e.total}</span>
              </span>
            ))}
            <span className="bz-sans text-sm bg-[#1B2430] text-white rounded-sm px-3 py-1.5">
              Total : <span className="bz-mono font-medium">{parQualite.reduce((s, e) => s + e.total, 0)}</span> bazin(s)
            </span>
          </div>
        )}

        <div className="bg-white border border-[#D8D2C2] rounded-sm overflow-x-auto">
          <table className="w-full text-sm bz-sans" style={{ minWidth: "860px" }}>
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-[#9AA0A6] border-b border-[#D8D2C2]">
                <th className="px-3 py-3 w-36">Date</th>
                <th className="px-3 py-3">Lancée par</th>
                <th className="px-3 py-3 w-44">Qualité de bazin</th>
                <th className="px-3 py-3 w-20">Qté</th>
                <th className="px-3 py-3 w-32">Prix (F CFA)</th>
                <th className="px-3 py-3 w-32">Renvoyé ?</th>
                <th className="px-3 py-3">Notes</th>
                <th className="px-3 py-3 w-10"></th>
              </tr>
            </thead>
            <tbody>
              {lignes.length === 0 && (
                <tr>
                  <td colSpan="8" className="px-5 py-6 text-[#9AA0A6]">
                    Aucune ligne. Cliquez sur « + Ajouter une ligne » et remplissez les cases directement, comme dans Excel.
                  </td>
                </tr>
              )}
              {lignes.map((t) => (
                <tr key={t.id}
                  className={`border-b border-[#EFEBDF] last:border-0 ${t.statut === "renvoye" ? "" : "bg-[#FDF8EF]"}`}>
                  <td className="px-1 py-1">
                    <input type="date" className={cellText + " bz-mono"} value={t.date || ""}
                      onChange={(e) => update(t.id, { date: e.target.value })} />
                  </td>
                  <td className="px-1 py-1">
                    <input className={cellText} placeholder="Qui a lancé la commande" value={t.lancePar || ""}
                      onChange={(e) => update(t.id, { lancePar: e.target.value })} />
                  </td>
                  <td className="px-1 py-1">
                    <select className={cellSelect} value={t.qualite || qualites[0]}
                      onChange={(e) => update(t.id, { qualite: e.target.value })}>
                      {qualites.map((q) => <option key={q} value={q}>{q}</option>)}
                    </select>
                  </td>
                  <td className="px-1 py-1">
                    <input type="number" min="0" step="1" className={cellText + " bz-mono text-right"} placeholder="0"
                      value={t.quantite ?? ""}
                      onChange={(e) => update(t.id, { quantite: e.target.value })} />
                  </td>
                  <td className="px-1 py-1">
                    <input type="number" min="0" step="1" className={cellText + " bz-mono text-right"} placeholder="0"
                      value={t.prix ?? ""}
                      onChange={(e) => update(t.id, { prix: e.target.value })} />
                  </td>
                  <td className="px-1 py-1">
                    <select
                      className={cellSelect + (t.statut === "renvoye" ? " text-[#1F6F5C] font-medium" : " text-[#B9832F] font-medium")}
                      value={t.statut || "en_teinture"}
                      onChange={(e) => update(t.id, { statut: e.target.value })}>
                      <option value="en_teinture">Non</option>
                      <option value="renvoye">Oui</option>
                    </select>
                  </td>
                  <td className="px-1 py-1">
                    <input className={cellText} value={t.notes || ""}
                      onChange={(e) => update(t.id, { notes: e.target.value })} />
                  </td>
                  <td className="px-1 py-1 text-center">
                    <button onClick={() => remove(t.id)} title="Supprimer la ligne"
                      className="text-[#C1652F] hover:underline text-sm px-2">✕</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="bz-sans text-xs text-[#9AA0A6] mt-3">
          Écrivez directement dans les cases : tout est enregistré automatiquement. Les lignes en jaune clair sont les bazins encore en teinture.
        </p>
      </div>
    );
  }

  /* ---- Liste des teinturiers ---- */
  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="bz-serif text-3xl font-semibold">Teinturiers</h1>
          <p className="bz-sans text-[#5B5F55]">
            {teinturiers.length} teinturier(s) · {teintures.filter((t) => t.statut !== "renvoye").length} bazin(s) encore en teinture
          </p>
        </div>
        <div className="flex gap-2 items-center">
          <SearchBox value={query} onChange={setQuery} placeholder="Rechercher un teinturier…" />
          <button onClick={() => exportTeintures(teintures, "bazin-teintures.csv")}
            className="bz-sans px-4 py-2 rounded-sm text-sm border border-[#D8D2C2] hover:bg-white">
            Exporter CSV
          </button>
          <button onClick={() => { setShowNew(true); setNewName(""); }}
            className="bz-sans bg-[#1F6F5C] text-white px-4 py-2 rounded-sm text-sm font-medium hover:bg-[#195A4A]">
            + Nouveau teinturier
          </button>
        </div>
      </div>

      {showNew && (
        <form onSubmit={creerTeinturier} className="bg-white border border-[#D8D2C2] rounded-sm p-5 mb-6 flex items-end gap-3">
          <Field label="Nom du teinturier">
            <input autoFocus required className={inputCls + " w-72"} value={newName}
              onChange={(e) => setNewName(e.target.value)} />
          </Field>
          <button type="submit" className="bz-sans bg-[#1B2430] text-white px-4 py-2 rounded-sm text-sm">
            Ouvrir son tableau
          </button>
          <button type="button" onClick={() => setShowNew(false)}
            className="bz-sans px-4 py-2 rounded-sm text-sm border border-[#D8D2C2]">
            Annuler
          </button>
        </form>
      )}

      {teinturiersAffiches.length === 0 ? (
        <div className="bg-white border border-[#D8D2C2] rounded-sm p-6">
          <p className="bz-sans text-sm text-[#9AA0A6]">
            {teintures.length === 0
              ? "Aucun teinturier pour l'instant. Cliquez sur « + Nouveau teinturier » : il aura son propre tableau modèle Excel."
              : "Aucun teinturier ne correspond à cette recherche."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-4">
          {teinturiersAffiches.map((t) => (
            <button key={t.nom} onClick={() => setSelection(t.nom)}
              className="text-left bg-white border border-[#D8D2C2] rounded-sm p-5 hover:border-[#1F6F5C] transition-colors">
              <div className="bz-serif text-lg font-semibold mb-1">{t.nom}</div>
              <div className="bz-sans text-sm text-[#5B5F55]">{t.nb} ligne(s)</div>
              <div className="bz-sans text-sm mb-2">
                {t.enTeinture > 0 ? (
                  <span className="text-[#B9832F]">{t.enTeinture} encore en teinture</span>
                ) : (
                  <span className="text-[#1F6F5C]">Tout a été renvoyé</span>
                )}
              </div>
              <div className="bz-mono text-sm">{fcfa(t.total)}</div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ============================================================ */
function CommandesView({ commandes, saveCommandes }) {
  const [query, setQuery] = useState("");

  const typesCommande = [
    "Bazin vainqueur Siri Siri",
    "Bazin vainqueur VIP",
    "Bazin vainqueur Facebook",
    "Teinture unique",
    "Teinture modèle",
    "Teinture VIP",
    "Teinture Facebook",
  ];
  const qualitesDonnees = [
    "Vainqueur blanc",
    "Moins riche blanc",
    "Riche blanc",
    "Habillement femme",
    "Habillement homme",
  ];

  const cellText = "w-full bg-transparent px-2 py-1.5 text-sm text-[#1B2430] border border-transparent rounded-sm focus:outline-none focus:border-[#1F6F5C] focus:bg-white";
  const cellSelect = cellText + " cursor-pointer";

  const estTeinture = (c) => (c.typeCommande || "").startsWith("Teinture");
  const totalDe = (c) => (Number(c.metrage) || 0) * (Number(c.prixMetre) || 0);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return commandes;
    return commandes.filter((c) =>
      [c.client, c.telephone, c.commandeChez, c.typeCommande, c.qualiteDonnee, c.notes]
        .some((v) => (v || "").toLowerCase().includes(q))
    );
  }, [commandes, query]);

  const nonRetirees = commandes.filter((c) => c.statut !== "retiree").length;
  const totalMontant = filtered.reduce((s, c) => s + totalDe(c), 0);

  const update = (id, patch) =>
    saveCommandes(commandes.map((c) => (c.id === id ? { ...c, ...patch } : c)));

  const changerStatut = (id, statut) => {
    const c = commandes.find((x) => x.id === id);
    const patch = { statut };
    if (statut === "retiree" && !(c && c.dateRetiree)) patch.dateRetiree = today();
    if (statut !== "retiree") patch.dateRetiree = "";
    update(id, patch);
  };

  const addRow = () =>
    saveCommandes([
      ...commandes,
      {
        id: uid(),
        date: today(),
        client: "",
        telephone: "",
        commandeChez: "",
        typeCommande: typesCommande[0],
        qualiteDonnee: "",
        metrage: "",
        prixMetre: "",
        dateRetrait: "",
        statut: "en_attente",
        dateRetiree: "",
        notes: "",
      },
    ]);

  const remove = (id) => saveCommandes(commandes.filter((c) => c.id !== id));

  const exportCommandes = () =>
    exportCSV(
      "bazin-commandes.csv",
      commandes.map((c) => ({
        ...c,
        statut: c.statut === "retiree" ? "Oui" : "Non",
        total: totalDe(c),
      })),
      [
        { key: "date", label: "Date de la commande" },
        { key: "client", label: "Personne qui a passé la commande" },
        { key: "telephone", label: "Numéro" },
        { key: "commandeChez", label: "Commande faite à" },
        { key: "typeCommande", label: "Type de commande" },
        { key: "qualiteDonnee", label: "Qualité de bazin donnée (teinture)" },
        { key: "metrage", label: "Métrage (m)" },
        { key: "prixMetre", label: "Prix par métrage (F CFA)" },
        { key: "total", label: "Total (F CFA)" },
        { key: "dateRetrait", label: "Jour de retrait prévu" },
        { key: "statut", label: "Retirée" },
        { key: "dateRetiree", label: "Jour du retrait effectif" },
        { key: "notes", label: "Notes" },
      ]
    );

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="bz-serif text-3xl font-semibold">Commandes de bazins</h1>
          <p className="bz-sans text-[#5B5F55]">
            {commandes.length} commande(s) · {nonRetirees} pas encore retirée(s) · total : <span className="bz-mono">{fcfa(totalMontant)}</span>
          </p>
        </div>
        <div className="flex gap-2 items-center">
          <SearchBox value={query} onChange={setQuery} placeholder="Rechercher une commande…" />
          <button onClick={exportCommandes}
            className="bz-sans px-4 py-2 rounded-sm text-sm border border-[#D8D2C2] hover:bg-white">
            Exporter CSV
          </button>
          <button onClick={addRow}
            className="bz-sans bg-[#1F6F5C] text-white px-4 py-2 rounded-sm text-sm font-medium hover:bg-[#195A4A]">
            + Nouvelle commande
          </button>
        </div>
      </div>

      <div className="bg-white border border-[#D8D2C2] rounded-sm overflow-x-auto">
        <table className="w-full text-sm bz-sans" style={{ minWidth: "1420px" }}>
          <thead>
            <tr className="text-left text-xs uppercase tracking-wide text-[#9AA0A6] border-b border-[#D8D2C2]">
              <th className="px-3 py-3 w-36">Date commande</th>
              <th className="px-3 py-3">Client</th>
              <th className="px-3 py-3 w-32">Numéro</th>
              <th className="px-3 py-3">Commande faite à</th>
              <th className="px-3 py-3 w-52">Type de commande</th>
              <th className="px-3 py-3 w-44">Qualité donnée</th>
              <th className="px-3 py-3 w-24">Métrage</th>
              <th className="px-3 py-3 w-28">Prix / m</th>
              <th className="px-3 py-3 w-28 text-right">Total</th>
              <th className="px-3 py-3 w-36">Retrait prévu</th>
              <th className="px-3 py-3 w-24">Retirée ?</th>
              <th className="px-3 py-3 w-36">Jour du retrait</th>
              <th className="px-3 py-3 w-32"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td colSpan="14" className="px-5 py-6 text-[#9AA0A6]">
                  {commandes.length === 0
                    ? "Aucune commande. Cliquez sur « + Nouvelle commande » et remplissez les cases directement, comme dans Excel."
                    : "Aucun résultat pour cette recherche."}
                </td>
              </tr>
            )}
            {filtered.map((c) => (
              <tr key={c.id}
                className={`border-b border-[#EFEBDF] last:border-0 ${c.statut === "retiree" ? "" : "bg-[#FDF8EF]"}`}>
                <td className="px-1 py-1">
                  <input type="date" className={cellText + " bz-mono"} value={c.date || ""}
                    onChange={(e) => update(c.id, { date: e.target.value })} />
                </td>
                <td className="px-1 py-1">
                  <input className={cellText + " font-medium"} placeholder="Nom du client" value={c.client || ""}
                    onChange={(e) => update(c.id, { client: e.target.value })} />
                </td>
                <td className="px-1 py-1">
                  <input className={cellText + " bz-mono"} placeholder="Téléphone" value={c.telephone || ""}
                    onChange={(e) => update(c.id, { telephone: e.target.value })} />
                </td>
                <td className="px-1 py-1">
                  <input className={cellText} placeholder="À qui on fait la commande" value={c.commandeChez || ""}
                    onChange={(e) => update(c.id, { commandeChez: e.target.value })} />
                </td>
                <td className="px-1 py-1">
                  <select className={cellSelect} value={c.typeCommande || typesCommande[0]}
                    onChange={(e) => update(c.id, { typeCommande: e.target.value })}>
                    {typesCommande.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </td>
                <td className="px-1 py-1">
                  {estTeinture(c) ? (
                    <select className={cellSelect} value={c.qualiteDonnee || ""}
                      onChange={(e) => update(c.id, { qualiteDonnee: e.target.value })}>
                      <option value="">— choisir —</option>
                      {qualitesDonnees.map((q) => <option key={q} value={q}>{q}</option>)}
                    </select>
                  ) : (
                    <span className="px-2 text-[#9AA0A6]">—</span>
                  )}
                </td>
                <td className="px-1 py-1">
                  <input type="number" min="0" step="0.5" className={cellText + " bz-mono text-right"} placeholder="0"
                    value={c.metrage ?? ""}
                    onChange={(e) => update(c.id, { metrage: e.target.value })} />
                </td>
                <td className="px-1 py-1">
                  <input type="number" min="0" step="1" className={cellText + " bz-mono text-right"} placeholder="0"
                    value={c.prixMetre ?? ""}
                    onChange={(e) => update(c.id, { prixMetre: e.target.value })} />
                </td>
                <td className="px-3 py-1 bz-mono text-right whitespace-nowrap">{fcfa(totalDe(c))}</td>
                <td className="px-1 py-1">
                  <input type="date" className={cellText + " bz-mono"} value={c.dateRetrait || ""}
                    onChange={(e) => update(c.id, { dateRetrait: e.target.value })} />
                </td>
                <td className="px-1 py-1">
                  <select
                    className={cellSelect + (c.statut === "retiree" ? " text-[#1F6F5C] font-medium" : " text-[#B9832F] font-medium")}
                    value={c.statut || "en_attente"}
                    onChange={(e) => changerStatut(c.id, e.target.value)}>
                    <option value="en_attente">Non</option>
                    <option value="retiree">Oui</option>
                  </select>
                </td>
                <td className="px-1 py-1">
                  {c.statut === "retiree" ? (
                    <input type="date" className={cellText + " bz-mono"} value={c.dateRetiree || ""}
                      onChange={(e) => update(c.id, { dateRetiree: e.target.value })} />
                  ) : (
                    <span className="px-2 text-[#9AA0A6]">—</span>
                  )}
                </td>
                <td className="px-1 py-1 text-right whitespace-nowrap">
                  {c.statut !== "retiree" && c.telephone && (
                    <button
                      onClick={() =>
                        ouvrirWhatsApp(
                          c.telephone,
                          `Bonjour${c.client ? " " + c.client : ""}, votre commande${c.typeCommande ? " (" + c.typeCommande + ")" : ""} est prête. Vous pouvez venir la retirer. Merci !`
                        )
                      }
                      title="Prévenir que la commande est prête sur WhatsApp"
                      className="text-[#1F6F5C] hover:underline text-xs mr-2">WhatsApp</button>
                  )}
                  <button onClick={() => remove(c.id)} title="Supprimer la ligne"
                    className="text-[#C1652F] hover:underline text-sm px-2">✕</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="bz-sans text-xs text-[#9AA0A6] mt-3">
        Écrivez directement dans les cases : tout est enregistré automatiquement. Les lignes en jaune clair sont les commandes pas encore retirées.
        Le bouton WhatsApp ouvre une conversation avec le client (message déjà écrit) pour le prévenir que sa commande est prête.
        Quand vous passez « Retirée ? » à Oui, le jour du retrait se remplit automatiquement avec la date du jour (modifiable).
        La colonne « Qualité donnée » ne s'active que pour les commandes de teinture.
      </p>
    </div>
  );
}

/* ============================================================ */
function VentesView({ ventes, saveVentes, stock, saveStock }) {
  const [query, setQuery] = useState("");
  const [filtreStatut, setFiltreStatut] = useState("tous");

  const qualites = [
    "Vainqueur blanc",
    "Moins riche blanc",
    "Riche blanc",
    "Habillement femme",
    "Habillement homme",
    "Bazin teint",
    "Autre",
  ];
  const modesPaiement = ["Espèces", "Wave", "Orange Money", "Free Money", "Virement", "Chèque", "Crédit", "Autre"];

  const cellText = "w-full bg-transparent px-2 py-1.5 text-sm text-[#1B2430] border border-transparent rounded-sm focus:outline-none focus:border-[#1F6F5C] focus:bg-white";
  const cellSelect = cellText + " cursor-pointer";

  const totalDe = (v) => (Number(v.metrage) || 0) * (Number(v.prixMetre) || 0);
  const resteDe = (v) => Math.max(0, totalDe(v) - (Number(v.montantPaye) || 0));
  const statutDe = (v) => {
    const total = totalDe(v);
    const paye = Number(v.montantPaye) || 0;
    if (total > 0 && paye >= total) return "paye";
    if (paye > 0) return "partiel";
    return "credit";
  };
  const statutInfo = {
    paye: { label: "Payé", tone: "ink" },
    partiel: { label: "Partiel", tone: "gold" },
    credit: { label: "Crédit", tone: "fade" },
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return ventes.filter((v) => {
      if (filtreStatut !== "tous" && statutDe(v) !== filtreStatut) return false;
      if (!q) return true;
      return [v.client, v.telephone, v.article, v.qualite, v.modePaiement, v.notes]
        .some((x) => (x || "").toLowerCase().includes(q));
    });
  }, [ventes, query, filtreStatut]);

  const totalVentes = filtered.reduce((s, v) => s + totalDe(v), 0);
  const totalEncaisse = filtered.reduce((s, v) => s + (Number(v.montantPaye) || 0), 0);
  const totalReste = filtered.reduce((s, v) => s + resteDe(v), 0);

  const update = (id, patch) =>
    saveVentes(ventes.map((v) => (v.id === id ? { ...v, ...patch } : v)));

  const addRow = () =>
    saveVentes([
      ...ventes,
      {
        id: uid(),
        date: today(),
        client: "",
        telephone: "",
        stockId: "",
        article: "",
        qualite: qualites[0],
        metrage: "",
        prixMetre: "",
        montantPaye: "",
        modePaiement: modesPaiement[0],
        deduitStock: false,
        qteDeduit: 0,
        notes: "",
      },
    ]);

  const solder = (id) => {
    const v = ventes.find((x) => x.id === id);
    if (v) update(id, { montantPaye: totalDe(v) });
  };

  // Choisir un article du stock : remplit le nom et le prix
  const choisirStock = (v, stockId) => {
    const item = stock.find((s) => s.id === stockId);
    const patch = { stockId };
    if (item) {
      patch.article = item.nom;
      if (!v.prixMetre) patch.prixMetre = item.prixUnitaire;
    }
    update(v.id, patch);
  };

  // Déduire / rendre la quantité vendue au stock
  const basculerDeduction = (v) => {
    const item = stock.find((s) => s.id === v.stockId);
    if (!item) {
      alert("Choisissez d'abord un article du stock sur cette ligne.");
      return;
    }
    if (v.deduitStock) {
      // rendre au stock
      saveStock(stock.map((s) => (s.id === item.id ? { ...s, quantite: (Number(s.quantite) || 0) + (Number(v.qteDeduit) || 0) } : s)));
      update(v.id, { deduitStock: false, qteDeduit: 0 });
    } else {
      const qte = Number(v.metrage) || 0;
      saveStock(stock.map((s) => (s.id === item.id ? { ...s, quantite: (Number(s.quantite) || 0) - qte } : s)));
      update(v.id, { deduitStock: true, qteDeduit: qte });
    }
  };

  const remove = (v) => {
    if (v.deduitStock && v.stockId) {
      const item = stock.find((s) => s.id === v.stockId);
      if (item) saveStock(stock.map((s) => (s.id === item.id ? { ...s, quantite: (Number(s.quantite) || 0) + (Number(v.qteDeduit) || 0) } : s)));
    }
    saveVentes(ventes.filter((x) => x.id !== v.id));
  };

  const exportVentes = () =>
    exportCSV(
      "bazin-ventes.csv",
      ventes.map((v) => ({
        ...v,
        total: totalDe(v),
        reste: resteDe(v),
        statut: statutInfo[statutDe(v)].label,
      })),
      [
        { key: "date", label: "Date" },
        { key: "client", label: "Client" },
        { key: "telephone", label: "Numéro" },
        { key: "article", label: "Article vendu" },
        { key: "qualite", label: "Qualité" },
        { key: "metrage", label: "Métrage (m)" },
        { key: "prixMetre", label: "Prix par métrage (F CFA)" },
        { key: "total", label: "Total (F CFA)" },
        { key: "montantPaye", label: "Montant payé (F CFA)" },
        { key: "reste", label: "Reste à payer (F CFA)" },
        { key: "modePaiement", label: "Mode de paiement" },
        { key: "statut", label: "Statut" },
        { key: "notes", label: "Notes" },
      ]
    );

  const filtres = [
    ["tous", "Toutes"],
    ["credit", "Crédit"],
    ["partiel", "Partiel"],
    ["paye", "Payé"],
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="bz-serif text-3xl font-semibold">Ventes</h1>
          <p className="bz-sans text-[#5B5F55]">{ventes.length} vente(s) enregistrée(s)</p>
        </div>
        <div className="flex gap-2 items-center">
          <SearchBox value={query} onChange={setQuery} placeholder="Rechercher une vente…" />
          <button onClick={exportVentes}
            className="bz-sans px-4 py-2 rounded-sm text-sm border border-[#D8D2C2] hover:bg-white">
            Exporter CSV
          </button>
          <button onClick={addRow}
            className="bz-sans bg-[#1F6F5C] text-white px-4 py-2 rounded-sm text-sm font-medium hover:bg-[#195A4A]">
            + Nouvelle vente
          </button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-5">
        <div className="bg-white border border-[#D8D2C2] rounded-sm px-5 py-4">
          <div className="bz-sans text-xs uppercase tracking-wide text-[#9AA0A6] mb-1">Total des ventes</div>
          <div className="bz-mono text-2xl font-medium">{fcfa(totalVentes)}</div>
        </div>
        <div className="bg-white border border-[#D8D2C2] rounded-sm px-5 py-4">
          <div className="bz-sans text-xs uppercase tracking-wide text-[#9AA0A6] mb-1">Encaissé</div>
          <div className="bz-mono text-2xl font-medium text-[#1F6F5C]">{fcfa(totalEncaisse)}</div>
        </div>
        <div className="bg-white border border-[#D8D2C2] rounded-sm px-5 py-4">
          <div className="bz-sans text-xs uppercase tracking-wide text-[#9AA0A6] mb-1">Reste à encaisser (crédit)</div>
          <div className="bz-mono text-2xl font-medium text-[#C1652F]">{fcfa(totalReste)}</div>
        </div>
      </div>

      <div className="flex gap-2 mb-4">
        {filtres.map(([key, label]) => (
          <button key={key} onClick={() => setFiltreStatut(key)}
            className={`bz-sans text-sm px-3 py-1.5 rounded-sm border transition-colors ${
              filtreStatut === key
                ? "bg-[#1B2430] text-white border-[#1B2430]"
                : "bg-white border-[#D8D2C2] text-[#5B5F55] hover:bg-[#FBF9F4]"
            }`}>
            {label}
          </button>
        ))}
      </div>

      <div className="bg-white border border-[#D8D2C2] rounded-sm overflow-x-auto">
        <table className="w-full text-sm bz-sans" style={{ minWidth: "1680px" }}>
          <thead>
            <tr className="text-left text-xs uppercase tracking-wide text-[#9AA0A6] border-b border-[#D8D2C2]">
              <th className="px-3 py-3 w-36">Date</th>
              <th className="px-3 py-3">Client</th>
              <th className="px-3 py-3 w-32">Numéro</th>
              <th className="px-3 py-3 w-48">Article du stock</th>
              <th className="px-3 py-3">Article vendu</th>
              <th className="px-3 py-3 w-40">Qualité</th>
              <th className="px-3 py-3 w-20">Mètre</th>
              <th className="px-3 py-3 w-24">Prix / m</th>
              <th className="px-3 py-3 w-28 text-right">Total</th>
              <th className="px-3 py-3 w-28">Payé</th>
              <th className="px-3 py-3 w-28 text-right">Reste</th>
              <th className="px-3 py-3 w-36">Mode paiement</th>
              <th className="px-3 py-3 w-24">Statut</th>
              <th className="px-3 py-3 w-40">Stock</th>
              <th className="px-3 py-3 w-40"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td colSpan="16" className="px-5 py-6 text-[#9AA0A6]">
                  {ventes.length === 0
                    ? "Aucune vente. Cliquez sur « + Nouvelle vente » et remplissez les cases directement, comme dans Excel."
                    : "Aucune vente ne correspond à ce filtre."}
                </td>
              </tr>
            )}
            {filtered.map((v) => {
              const st = statutDe(v);
              const reste = resteDe(v);
              const item = stock.find((s) => s.id === v.stockId);
              return (
                <tr key={v.id}
                  className={`border-b border-[#EFEBDF] last:border-0 ${st === "paye" ? "" : "bg-[#FDF8EF]"}`}>
                  <td className="px-1 py-1">
                    <input type="date" className={cellText + " bz-mono"} value={v.date || ""}
                      onChange={(e) => update(v.id, { date: e.target.value })} />
                  </td>
                  <td className="px-1 py-1">
                    <input className={cellText + " font-medium"} placeholder="Nom du client" value={v.client || ""}
                      onChange={(e) => update(v.id, { client: e.target.value })} />
                  </td>
                  <td className="px-1 py-1">
                    <input className={cellText + " bz-mono"} placeholder="Téléphone" value={v.telephone || ""}
                      onChange={(e) => update(v.id, { telephone: e.target.value })} />
                  </td>
                  <td className="px-1 py-1">
                    <select className={cellSelect} value={v.stockId || ""}
                      disabled={v.deduitStock}
                      onChange={(e) => choisirStock(v, e.target.value)}>
                      <option value="">— hors stock —</option>
                      {stock.map((s) => <option key={s.id} value={s.id}>{s.nom}</option>)}
                    </select>
                  </td>
                  <td className="px-1 py-1">
                    <input className={cellText} placeholder="Ce qui est vendu" value={v.article || ""}
                      onChange={(e) => update(v.id, { article: e.target.value })} />
                  </td>
                  <td className="px-1 py-1">
                    <select className={cellSelect} value={v.qualite || qualites[0]}
                      onChange={(e) => update(v.id, { qualite: e.target.value })}>
                      {qualites.map((q) => <option key={q} value={q}>{q}</option>)}
                    </select>
                  </td>
                  <td className="px-1 py-1">
                    <input type="number" min="0" step="0.5" className={cellText + " bz-mono text-right"} placeholder="0"
                      value={v.metrage ?? ""}
                      onChange={(e) => update(v.id, { metrage: e.target.value })} />
                  </td>
                  <td className="px-1 py-1">
                    <input type="number" min="0" step="1" className={cellText + " bz-mono text-right"} placeholder="0"
                      value={v.prixMetre ?? ""}
                      onChange={(e) => update(v.id, { prixMetre: e.target.value })} />
                  </td>
                  <td className="px-3 py-1 bz-mono text-right whitespace-nowrap font-medium">{fcfa(totalDe(v))}</td>
                  <td className="px-1 py-1">
                    <input type="number" min="0" step="1" className={cellText + " bz-mono text-right"} placeholder="0"
                      value={v.montantPaye ?? ""}
                      onChange={(e) => update(v.id, { montantPaye: e.target.value })} />
                  </td>
                  <td className={`px-3 py-1 bz-mono text-right whitespace-nowrap ${reste > 0 ? "text-[#C1652F] font-medium" : "text-[#9AA0A6]"}`}>
                    {fcfa(reste)}
                  </td>
                  <td className="px-1 py-1">
                    <select className={cellSelect} value={v.modePaiement || modesPaiement[0]}
                      onChange={(e) => update(v.id, { modePaiement: e.target.value })}>
                      {modesPaiement.map((m) => <option key={m} value={m}>{m}</option>)}
                    </select>
                  </td>
                  <td className="px-2 py-1 whitespace-nowrap">
                    <Tampon label={statutInfo[st].label} tone={statutInfo[st].tone} />
                  </td>
                  <td className="px-2 py-1 text-xs whitespace-nowrap">
                    {v.stockId ? (
                      <label className="flex items-center gap-1.5 cursor-pointer">
                        <input type="checkbox" checked={!!v.deduitStock}
                          onChange={() => basculerDeduction(v)} />
                        {v.deduitStock
                          ? <span className="text-[#1F6F5C]">retiré ({v.qteDeduit} m)</span>
                          : <span className="text-[#5B5F55]">déduire · reste {item ? item.quantite : "?"}</span>}
                      </label>
                    ) : (
                      <span className="text-[#9AA0A6]">—</span>
                    )}
                  </td>
                  <td className="px-1 py-1 text-right whitespace-nowrap">
                    {reste > 0 && v.telephone && (
                      <button
                        onClick={() =>
                          ouvrirWhatsApp(
                            v.telephone,
                            `Bonjour${v.client ? " " + v.client : ""}, petit rappel concernant votre achat${v.article ? " de " + v.article : ""} du ${fmtDate(v.date)} d'un montant de ${fcfa(totalDe(v))}. Il reste ${fcfa(reste)} à régler. Merci !`
                          )
                        }
                        title="Rappel de paiement sur WhatsApp"
                        className="text-[#1F6F5C] hover:underline text-xs mr-2">WhatsApp</button>
                    )}
                    {st !== "paye" && (
                      <button onClick={() => solder(v.id)} title="Marquer entièrement payé"
                        className="text-[#1F6F5C] hover:underline text-xs mr-2">Soldé</button>
                    )}
                    <button onClick={() => remove(v)} title="Supprimer la ligne"
                      className="text-[#C1652F] hover:underline text-sm">✕</button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="bz-sans text-xs text-[#9AA0A6] mt-3">
        Écrivez directement dans les cases : tout est enregistré automatiquement. Le total et le reste à payer se calculent tout seuls.
        Choisissez un « Article du stock » puis cochez « déduire » : la quantité vendue est retirée du stock (inventaire à jour en même temps que la vente).
        Décochez pour rendre la quantité au stock. Les lignes en jaune clair ne sont pas encore entièrement payées.
      </p>
    </div>
  );
}

/* ============================================================ */
function RappelsView({ ventes, commandes }) {
  const totalVente = (v) => (Number(v.metrage) || 0) * (Number(v.prixMetre) || 0);
  const resteVente = (v) => Math.max(0, totalVente(v) - (Number(v.montantPaye) || 0));
  const totalCmd = (c) => (Number(c.metrage) || 0) * (Number(c.prixMetre) || 0);

  const credits = ventes
    .filter((v) => resteVente(v) > 0)
    .sort((a, b) => resteVente(b) - resteVente(a));
  const totalCredits = credits.reduce((s, v) => s + resteVente(v), 0);

  const aRetirer = commandes
    .filter((c) => c.statut !== "retiree")
    .sort((a, b) => (a.dateRetrait || "") < (b.dateRetrait || "") ? -1 : 1);

  const boutonWA = "inline-flex items-center gap-2 bg-[#25D366] text-white px-4 py-2 rounded-sm text-sm font-medium hover:bg-[#1EBE5A] whitespace-nowrap";
  const sansNumero = "text-xs text-[#9AA0A6] italic whitespace-nowrap";

  return (
    <div>
      <h1 className="bz-serif text-3xl font-semibold mb-1">Rappels WhatsApp</h1>
      <p className="bz-sans text-[#5B5F55] mb-8">
        Appuyez sur un bouton vert : votre WhatsApp s'ouvre avec le message déjà écrit, vous n'avez plus qu'à envoyer.
      </p>

      {/* ---- Clients qui doivent de l'argent ---- */}
      <div className="mb-10">
        <div className="flex items-baseline justify-between mb-3">
          <h2 className="bz-serif text-xl font-semibold">Clients qui doivent de l'argent</h2>
          <span className="bz-sans text-sm text-[#5B5F55]">
            {credits.length} client(s) · reste <span className="bz-mono text-[#C1652F] font-medium">{fcfa(totalCredits)}</span>
          </span>
        </div>

        {credits.length === 0 ? (
          <div className="bg-white border border-[#D8D2C2] rounded-sm p-6 bz-sans text-sm text-[#9AA0A6]">
            Aucun client ne vous doit de l'argent. 👍
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {credits.map((v) => (
              <div key={v.id}
                className="bg-white border border-[#D8D2C2] rounded-sm p-4 flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="bz-sans font-medium text-[#1B2430]">{v.client || "Client sans nom"}</div>
                  <div className="bz-sans text-sm text-[#5B5F55]">
                    {v.article || "Vente"}{v.date ? ` · ${fmtDate(v.date)}` : ""}
                    {v.telephone ? ` · ${v.telephone}` : ""}
                  </div>
                  <div className="bz-sans text-sm mt-0.5">
                    Total <span className="bz-mono">{fcfa(totalVente(v))}</span>
                    {" · "}Payé <span className="bz-mono">{fcfa(Number(v.montantPaye) || 0)}</span>
                    {" · "}<span className="text-[#C1652F] font-medium">Reste <span className="bz-mono">{fcfa(resteVente(v))}</span></span>
                  </div>
                </div>
                {v.telephone ? (
                  <button className={boutonWA}
                    onClick={() =>
                      ouvrirWhatsApp(
                        v.telephone,
                        `Bonjour${v.client ? " " + v.client : ""}, petit rappel concernant votre achat${v.article ? " de " + v.article : ""} du ${fmtDate(v.date)} d'un montant de ${fcfa(totalVente(v))}. Il reste ${fcfa(resteVente(v))} à régler. Merci !`
                      )
                    }>
                    <span>Rappeler sur WhatsApp</span>
                  </button>
                ) : (
                  <span className={sansNumero}>Ajoutez un numéro dans Ventes</span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ---- Commandes à retirer ---- */}
      <div>
        <div className="flex items-baseline justify-between mb-3">
          <h2 className="bz-serif text-xl font-semibold">Commandes à prévenir / retirer</h2>
          <span className="bz-sans text-sm text-[#5B5F55]">{aRetirer.length} commande(s) non retirée(s)</span>
        </div>

        {aRetirer.length === 0 ? (
          <div className="bg-white border border-[#D8D2C2] rounded-sm p-6 bz-sans text-sm text-[#9AA0A6]">
            Aucune commande en attente de retrait.
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {aRetirer.map((c) => (
              <div key={c.id}
                className="bg-white border border-[#D8D2C2] rounded-sm p-4 flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="bz-sans font-medium text-[#1B2430]">{c.client || "Client sans nom"}</div>
                  <div className="bz-sans text-sm text-[#5B5F55]">
                    {c.typeCommande || "Commande"}
                    {c.telephone ? ` · ${c.telephone}` : ""}
                    {c.dateRetrait ? ` · retrait prévu le ${fmtDate(c.dateRetrait)}` : ""}
                  </div>
                  {totalCmd(c) > 0 && (
                    <div className="bz-sans text-sm mt-0.5">Montant <span className="bz-mono">{fcfa(totalCmd(c))}</span></div>
                  )}
                </div>
                {c.telephone ? (
                  <button className={boutonWA}
                    onClick={() =>
                      ouvrirWhatsApp(
                        c.telephone,
                        `Bonjour${c.client ? " " + c.client : ""}, votre commande${c.typeCommande ? " (" + c.typeCommande + ")" : ""} est prête. Vous pouvez venir la retirer. Merci !`
                      )
                    }>
                    <span>Prévenir sur WhatsApp</span>
                  </button>
                ) : (
                  <span className={sansNumero}>Ajoutez un numéro dans Commandes</span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ============================================================ */
const MODES_CAISSE = ["Espèces", "Wave", "Orange Money", "Free Money", "Carte", "Autre"];

function ligneMontant(l) {
  return (Number(l.quantite) || 0) * (Number(l.prixUnitaire) || 0);
}
function ticketTotal(t) {
  return (t.lignes || []).reduce((s, l) => s + ligneMontant(l), 0);
}

function CaisseView({ caisse, saveCaisse }) {
  const [jour, setJour] = useState(today());
  const [draft, setDraft] = useState(null); // encaissement en cours
  const [recu, setRecu] = useState(null); // ticket affiché en reçu

  const nextNumero = () => {
    const year = new Date().getFullYear();
    return `T-${year}-${String(caisse.length + 1).padStart(3, "0")}`;
  };

  const nouveau = () =>
    setDraft({
      id: uid(),
      numero: nextNumero(),
      dateTime: new Date().toISOString(),
      client: "",
      telephone: "",
      mode: MODES_CAISSE[0],
      recu: "",
      notes: "",
      lignes: [{ id: uid(), description: "", quantite: 1, prixUnitaire: "" }],
    });

  const addLigne = () =>
    setDraft({ ...draft, lignes: [...draft.lignes, { id: uid(), description: "", quantite: 1, prixUnitaire: "" }] });
  const updLigne = (i, patch) =>
    setDraft({ ...draft, lignes: draft.lignes.map((l, idx) => (idx === i ? { ...l, ...patch } : l)) });
  const rmLigne = (i) =>
    setDraft({ ...draft, lignes: draft.lignes.filter((_, idx) => idx !== i) });

  const totalDraft = draft ? ticketTotal(draft) : 0;
  const monnaie = draft && draft.mode === "Espèces" && draft.recu !== ""
    ? (Number(draft.recu) || 0) - totalDraft
    : null;

  const encaisser = (e) => {
    e.preventDefault();
    if (totalDraft <= 0) {
      alert("Ajoutez au moins un article avec un montant.");
      return;
    }
    const ticket = { ...draft, dateTime: new Date().toISOString() };
    saveCaisse([...caisse, ticket]);
    setDraft(null);
    setRecu(ticket);
    setJour(ticket.dateTime.slice(0, 10));
  };

  const supprimer = (id) => {
    if (window.confirm("Supprimer ce ticket de la caisse ?")) {
      saveCaisse(caisse.filter((t) => t.id !== id));
    }
  };

  const ticketsJour = caisse
    .filter((t) => (t.dateTime || "").slice(0, 10) === jour)
    .sort((a, b) => (a.dateTime < b.dateTime ? 1 : -1));

  const totalJour = ticketsJour.reduce((s, t) => s + ticketTotal(t), 0);
  const parMode = MODES_CAISSE
    .map((m) => ({ mode: m, total: ticketsJour.filter((t) => t.mode === m).reduce((s, t) => s + ticketTotal(t), 0) }))
    .filter((x) => x.total > 0);

  const exporter = () =>
    exportCSV(
      `bazin-caisse-${jour}.csv`,
      ticketsJour.map((t) => ({
        heure: (t.dateTime || "").slice(11, 16),
        numero: t.numero,
        client: t.client,
        articles: (t.lignes || []).map((l) => `${l.quantite}x ${l.description}`).join(", "),
        mode: t.mode,
        total: ticketTotal(t),
      })),
      [
        { key: "heure", label: "Heure" },
        { key: "numero", label: "Ticket" },
        { key: "client", label: "Client" },
        { key: "articles", label: "Articles" },
        { key: "mode", label: "Mode de paiement" },
        { key: "total", label: "Total (F CFA)" },
      ]
    );

  return (
    <div>
      {recu && <RecuView ticket={recu} onClose={() => setRecu(null)} />}

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="bz-serif text-3xl font-semibold">Caisse</h1>
          <p className="bz-sans text-[#5B5F55]">Encaissez, imprimez ou envoyez le reçu, suivez la caisse du jour.</p>
        </div>
        {!draft && (
          <button onClick={nouveau}
            className="bz-sans bg-[#1F6F5C] text-white px-5 py-3 rounded-sm text-base font-medium hover:bg-[#195A4A]">
            + Encaisser
          </button>
        )}
      </div>

      {/* ---- Écran d'encaissement ---- */}
      {draft && (
        <form onSubmit={encaisser} className="bg-white border border-[#1F6F5C] rounded-sm p-5 mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="bz-serif text-xl font-semibold">Encaissement</h2>
            <span className="bz-mono text-sm text-[#9AA0A6]">{draft.numero}</span>
          </div>

          <div className="grid grid-cols-2 gap-4 mb-4">
            <Field label="Client (facultatif)">
              <input className={inputCls} value={draft.client}
                onChange={(e) => setDraft({ ...draft, client: e.target.value })} />
            </Field>
            <Field label="Téléphone (pour envoyer le reçu)">
              <input className={inputCls} value={draft.telephone}
                onChange={(e) => setDraft({ ...draft, telephone: e.target.value })} />
            </Field>
          </div>

          <div className="text-sm font-medium text-[#5B5F55] mb-2">Articles</div>
          <div className="flex flex-col gap-2 mb-2">
            {draft.lignes.map((l, i) => (
              <div key={l.id} className="grid grid-cols-12 gap-2 items-center">
                <input className={inputCls + " col-span-6"} placeholder="Article / description" value={l.description}
                  onChange={(e) => updLigne(i, { description: e.target.value })} />
                <input type="number" min="0" step="0.5" className={inputCls + " col-span-2 text-right"} placeholder="Qté"
                  value={l.quantite} onChange={(e) => updLigne(i, { quantite: e.target.value })} />
                <input type="number" min="0" step="1" className={inputCls + " col-span-3 text-right"} placeholder="Prix unité"
                  value={l.prixUnitaire} onChange={(e) => updLigne(i, { prixUnitaire: e.target.value })} />
                <button type="button" onClick={() => rmLigne(i)}
                  className="col-span-1 text-[#C1652F] hover:underline text-sm">✕</button>
              </div>
            ))}
          </div>
          <button type="button" onClick={addLigne} className="bz-sans text-sm text-[#1F6F5C] hover:underline mb-4">
            + Ajouter un article
          </button>

          <div className="grid grid-cols-3 gap-4 items-end border-t border-[#EFEBDF] pt-4">
            <Field label="Mode de paiement">
              <select className={inputCls} value={draft.mode}
                onChange={(e) => setDraft({ ...draft, mode: e.target.value })}>
                {MODES_CAISSE.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
            </Field>
            {draft.mode === "Espèces" ? (
              <Field label="Montant reçu (pour la monnaie)">
                <input type="number" min="0" step="1" className={inputCls + " text-right"} placeholder="0"
                  value={draft.recu} onChange={(e) => setDraft({ ...draft, recu: e.target.value })} />
              </Field>
            ) : <div />}
            <div className="text-right">
              <div className="bz-sans text-xs uppercase tracking-wide text-[#9AA0A6]">Total à payer</div>
              <div className="bz-mono text-3xl font-semibold">{fcfa(totalDraft)}</div>
              {monnaie !== null && monnaie >= 0 && (
                <div className="bz-sans text-sm text-[#1F6F5C] mt-1">Monnaie à rendre : <span className="bz-mono">{fcfa(monnaie)}</span></div>
              )}
              {monnaie !== null && monnaie < 0 && (
                <div className="bz-sans text-sm text-[#C1652F] mt-1">Manque : <span className="bz-mono">{fcfa(-monnaie)}</span></div>
              )}
            </div>
          </div>

          <div className="flex gap-3 mt-5">
            <button type="submit"
              className="bz-sans bg-[#1F6F5C] text-white px-5 py-2.5 rounded-sm text-sm font-medium hover:bg-[#195A4A]">
              Encaisser et voir le reçu
            </button>
            <button type="button" onClick={() => setDraft(null)}
              className="bz-sans px-4 py-2.5 rounded-sm text-sm border border-[#D8D2C2]">
              Annuler
            </button>
          </div>
        </form>
      )}

      {/* ---- Caisse du jour ---- */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="bz-serif text-xl font-semibold">Caisse du jour</h2>
        <div className="flex gap-2 items-center">
          <input type="date" className={inputCls + " bz-mono"} value={jour}
            onChange={(e) => setJour(e.target.value)} />
          {ticketsJour.length > 0 && (
            <button onClick={exporter}
              className="bz-sans px-4 py-2 rounded-sm text-sm border border-[#D8D2C2] hover:bg-white">
              Exporter CSV
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-4">
        <div className="bg-white border border-[#D8D2C2] rounded-sm px-5 py-4">
          <div className="bz-sans text-xs uppercase tracking-wide text-[#9AA0A6] mb-1">Total encaissé</div>
          <div className="bz-mono text-2xl font-medium text-[#1F6F5C]">{fcfa(totalJour)}</div>
        </div>
        <div className="bg-white border border-[#D8D2C2] rounded-sm px-5 py-4">
          <div className="bz-sans text-xs uppercase tracking-wide text-[#9AA0A6] mb-1">Nombre de ventes</div>
          <div className="bz-mono text-2xl font-medium">{ticketsJour.length}</div>
        </div>
        <div className="bg-white border border-[#D8D2C2] rounded-sm px-5 py-4">
          <div className="bz-sans text-xs uppercase tracking-wide text-[#9AA0A6] mb-1">Détail par paiement</div>
          {parMode.length === 0 ? (
            <div className="bz-sans text-sm text-[#9AA0A6]">—</div>
          ) : (
            <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1">
              {parMode.map((x) => (
                <span key={x.mode} className="bz-sans text-sm">
                  {x.mode} <span className="bz-mono font-medium">{fcfa(x.total)}</span>
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="bg-white border border-[#D8D2C2] rounded-sm overflow-hidden">
        {ticketsJour.length === 0 ? (
          <p className="bz-sans text-sm text-[#9AA0A6] p-6">
            Aucune vente pour ce jour. Cliquez sur « + Encaisser » pour votre première vente.
          </p>
        ) : (
          <table className="w-full text-sm bz-sans">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-[#9AA0A6] border-b border-[#D8D2C2]">
                <th className="px-5 py-3 w-20">Heure</th>
                <th className="px-5 py-3 w-28">Ticket</th>
                <th className="px-5 py-3">Client / articles</th>
                <th className="px-5 py-3 w-32">Paiement</th>
                <th className="px-5 py-3 w-32 text-right">Total</th>
                <th className="px-5 py-3 text-right"></th>
              </tr>
            </thead>
            <tbody>
              {ticketsJour.map((t) => (
                <tr key={t.id} className="bz-row border-b border-[#EFEBDF] last:border-0">
                  <td className="px-5 py-3 bz-mono">{(t.dateTime || "").slice(11, 16)}</td>
                  <td className="px-5 py-3 bz-mono">{t.numero}</td>
                  <td className="px-5 py-3">
                    {t.client && <span className="font-medium">{t.client} · </span>}
                    <span className="text-[#5B5F55]">
                      {(t.lignes || []).map((l) => `${l.quantite}× ${l.description || "article"}`).join(", ")}
                    </span>
                  </td>
                  <td className="px-5 py-3">{t.mode}</td>
                  <td className="px-5 py-3 bz-mono text-right font-medium">{fcfa(ticketTotal(t))}</td>
                  <td className="px-5 py-3 text-right whitespace-nowrap">
                    <button onClick={() => setRecu(t)} className="text-[#1B2430] mr-3 hover:underline">Reçu</button>
                    {t.telephone && (
                      <button
                        onClick={() =>
                          ouvrirWhatsApp(t.telephone, texteRecu(t))
                        }
                        className="text-[#1F6F5C] mr-3 hover:underline">WhatsApp</button>
                    )}
                    <button onClick={() => supprimer(t.id)} className="text-[#C1652F] hover:underline">✕</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

/* Texte du reçu pour WhatsApp */
function texteRecu(t) {
  const lignes = (t.lignes || [])
    .map((l) => `- ${l.quantite}× ${l.description || "article"} : ${fcfa(ligneMontant(l))}`)
    .join("\n");
  const d = t.dateTime || "";
  return `*Bazin* — Reçu ${t.numero}\n${fmtDate(d.slice(0, 10))} ${d.slice(11, 16)}\n${lignes}\n\nTotal : ${fcfa(ticketTotal(t))}\nPayé par : ${t.mode}\n\nMerci de votre visite !`;
}

/* ---------- Reçu imprimable ---------- */
function RecuView({ ticket, onClose }) {
  const total = ticketTotal(ticket);
  const d = ticket.dateTime || "";
  const monnaie = ticket.mode === "Espèces" && ticket.recu !== "" && ticket.recu != null
    ? (Number(ticket.recu) || 0) - total
    : null;
  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-start justify-center overflow-y-auto py-10">
      <div className="bz-no-print fixed top-4 right-4 flex gap-2">
        <button onClick={() => window.print()} className="bz-sans bg-[#1F6F5C] text-white px-4 py-2 rounded-sm text-sm">
          Imprimer / PDF
        </button>
        {ticket.telephone && (
          <button onClick={() => ouvrirWhatsApp(ticket.telephone, texteRecu(ticket))}
            className="bz-sans bg-[#25D366] text-white px-4 py-2 rounded-sm text-sm">
            Envoyer sur WhatsApp
          </button>
        )}
        <button onClick={onClose} className="bz-sans bg-white px-4 py-2 rounded-sm text-sm border border-[#D8D2C2]">
          Fermer
        </button>
      </div>

      <div className="bz-print-area bg-white px-8 py-8 bz-sans text-[#1B2430]" style={{ width: "320px" }}>
        <div className="text-center mb-4">
          <div className="bz-serif text-2xl font-semibold">Bazin</div>
          <div className="text-xs text-[#9AA0A6]">Reçu de caisse</div>
        </div>
        <div className="text-xs text-[#5B5F55] mb-3 flex justify-between">
          <span className="bz-mono">{ticket.numero}</span>
          <span className="bz-mono">{fmtDate(d.slice(0, 10))} {d.slice(11, 16)}</span>
        </div>
        {ticket.client && <div className="text-sm mb-3">Client : {ticket.client}</div>}
        <div className="border-t border-dashed border-[#9AA0A6] my-2" />
        <table className="w-full text-sm">
          <tbody>
            {(ticket.lignes || []).map((l) => (
              <tr key={l.id} className="align-top">
                <td className="py-1">
                  {l.description || "Article"}
                  <div className="text-xs text-[#9AA0A6] bz-mono">{l.quantite} × {fcfa(l.prixUnitaire)}</div>
                </td>
                <td className="py-1 text-right bz-mono whitespace-nowrap">{fcfa(ligneMontant(l))}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="border-t border-dashed border-[#9AA0A6] my-2" />
        <div className="flex justify-between text-lg font-semibold">
          <span className="bz-serif">Total</span>
          <span className="bz-mono">{fcfa(total)}</span>
        </div>
        <div className="text-sm mt-2 flex justify-between">
          <span className="text-[#5B5F55]">Paiement</span>
          <span>{ticket.mode}</span>
        </div>
        {monnaie !== null && monnaie >= 0 && ticket.recu !== "" && (
          <>
            <div className="text-sm flex justify-between">
              <span className="text-[#5B5F55]">Reçu</span>
              <span className="bz-mono">{fcfa(ticket.recu)}</span>
            </div>
            <div className="text-sm flex justify-between">
              <span className="text-[#5B5F55]">Monnaie</span>
              <span className="bz-mono">{fcfa(monnaie)}</span>
            </div>
          </>
        )}
        <div className="text-center text-xs text-[#9AA0A6] mt-5">Merci de votre visite !</div>
      </div>
    </div>
  );
}

/* ============================================================ */
function ProductionView({ productions, saveProductions, stock, saveStock }) {
  const [query, setQuery] = useState("");

  const qualites = ["Vainqueur blanc", "Moins riche blanc", "Riche blanc", "Habillement femme", "Habillement homme"];

  const cellText = "w-full bg-transparent px-2 py-1.5 text-sm text-[#1B2430] border border-transparent rounded-sm focus:outline-none focus:border-[#1F6F5C] focus:bg-white";
  const cellSelect = cellText + " cursor-pointer";

  const totalDe = (p) => (Number(p.metrage) || 0) * (Number(p.prixInitial) || 0);

  // Nom de l'article une fois teint, tel qu'il entrera dans le stock
  const nomArticle = (p) => {
    const base = (p.qualite || "Bazin").replace(/\s*blanc$/i, "").trim();
    const coul = (p.couleur || "").trim();
    return coul ? `${base} teint ${coul}` : `${base} teint`;
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return productions;
    return productions.filter((p) =>
      [p.qualite, p.couleur, p.teinturier, p.notes].some((x) => (x || "").toLowerCase().includes(q))
    );
  }, [productions, query]);

  const enCours = productions.filter((p) => p.statut !== "termine").length;
  const totalCout = filtered.reduce((s, p) => s + totalDe(p), 0);

  const update = (id, patch) =>
    saveProductions(productions.map((p) => (p.id === id ? { ...p, ...patch } : p)));

  const addRow = () =>
    saveProductions([
      ...productions,
      {
        id: uid(),
        date: today(),
        qualite: qualites[0],
        couleur: "",
        teinturier: "",
        metrage: "",
        prixInitial: "",
        statut: "en_cours",
        enStock: false,
        qteEntree: 0,
        stockId: "",
        notes: "",
      },
    ]);

  const remove = (p) => {
    // si déjà entré en stock, on retire d'abord la quantité ajoutée
    if (p.enStock && p.stockId) {
      const item = stock.find((s) => s.id === p.stockId);
      if (item) saveStock(stock.map((s) => (s.id === item.id ? { ...s, quantite: (Number(s.quantite) || 0) - (Number(p.qteEntree) || 0) } : s)));
    }
    saveProductions(productions.filter((x) => x.id !== p.id));
  };

  // Entrer / retirer du stock de l'entreprise
  const basculerStock = (p) => {
    if (p.enStock) {
      // retirer du stock
      const item = stock.find((s) => s.id === p.stockId);
      if (item) saveStock(stock.map((s) => (s.id === item.id ? { ...s, quantite: (Number(s.quantite) || 0) - (Number(p.qteEntree) || 0) } : s)));
      update(p.id, { enStock: false, qteEntree: 0, stockId: "" });
      return;
    }
    const qte = Number(p.metrage) || 0;
    if (qte <= 0) {
      alert("Indiquez d'abord le métrage avant d'entrer en stock.");
      return;
    }
    const nom = nomArticle(p);
    const existant = stock.find((s) => (s.nom || "").toLowerCase() === nom.toLowerCase());
    if (existant) {
      saveStock(stock.map((s) => (s.id === existant.id ? { ...s, quantite: (Number(s.quantite) || 0) + qte } : s)));
      update(p.id, { enStock: true, qteEntree: qte, stockId: existant.id, statut: "termine" });
    } else {
      const nouvel = {
        id: uid(),
        nom,
        quantite: qte,
        prixUnitaire: Number(p.prixInitial) || 0,
        seuilAlerte: 0,
        fournisseurId: "",
      };
      saveStock([...stock, nouvel]);
      update(p.id, { enStock: true, qteEntree: qte, stockId: nouvel.id, statut: "termine" });
    }
  };

  const exporter = () =>
    exportCSV(
      "bazin-teinture-entreprise.csv",
      productions.map((p) => ({
        ...p,
        total: totalDe(p),
        statut: p.statut === "termine" ? "Terminé" : "En cours",
        enStock: p.enStock ? "Oui" : "Non",
        article: nomArticle(p),
      })),
      [
        { key: "date", label: "Date" },
        { key: "qualite", label: "Qualité du bazin blanc" },
        { key: "couleur", label: "Teinture / couleur" },
        { key: "teinturier", label: "Teinturier" },
        { key: "metrage", label: "Métrage (m)" },
        { key: "prixInitial", label: "Prix initial / m (F CFA)" },
        { key: "total", label: "Coût total (F CFA)" },
        { key: "statut", label: "Statut" },
        { key: "article", label: "Article en stock" },
        { key: "enStock", label: "Entré en stock" },
        { key: "notes", label: "Notes" },
      ]
    );

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <div>
          <h1 className="bz-serif text-3xl font-semibold">Teinture entreprise</h1>
          <p className="bz-sans text-[#5B5F55]">
            {productions.length} teinture(s) · {enCours} en cours · coût total : <span className="bz-mono">{fcfa(totalCout)}</span>
          </p>
        </div>
        <div className="flex gap-2 items-center">
          <SearchBox value={query} onChange={setQuery} placeholder="Rechercher…" />
          <button onClick={exporter}
            className="bz-sans px-4 py-2 rounded-sm text-sm border border-[#D8D2C2] hover:bg-white">
            Exporter CSV
          </button>
          <button onClick={addRow}
            className="bz-sans bg-[#1F6F5C] text-white px-4 py-2 rounded-sm text-sm font-medium hover:bg-[#195A4A]">
            + Nouvelle teinture
          </button>
        </div>
      </div>
      <p className="bz-sans text-sm text-[#5B5F55] mb-5">
        Votre bazin blanc part en teinture pour l'entreprise. Une fois terminé, cochez « en stock » : le bazin teint entre directement dans votre stock, prêt à vendre.
      </p>

      <div className="bg-white border border-[#D8D2C2] rounded-sm overflow-x-auto">
        <table className="w-full text-sm bz-sans" style={{ minWidth: "1240px" }}>
          <thead>
            <tr className="text-left text-xs uppercase tracking-wide text-[#9AA0A6] border-b border-[#D8D2C2]">
              <th className="px-3 py-3 w-36">Date</th>
              <th className="px-3 py-3 w-44">Qualité du bazin blanc</th>
              <th className="px-3 py-3">Teinture / couleur</th>
              <th className="px-3 py-3">Teinturier</th>
              <th className="px-3 py-3 w-24">Métrage</th>
              <th className="px-3 py-3 w-28">Prix initial / m</th>
              <th className="px-3 py-3 w-28 text-right">Coût total</th>
              <th className="px-3 py-3 w-28">Statut</th>
              <th className="px-3 py-3 w-52">Stock entreprise</th>
              <th className="px-3 py-3 w-10"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td colSpan="10" className="px-5 py-6 text-[#9AA0A6]">
                  {productions.length === 0
                    ? "Aucune teinture. Cliquez sur « + Nouvelle teinture » et remplissez les cases directement, comme dans Excel."
                    : "Aucun résultat pour cette recherche."}
                </td>
              </tr>
            )}
            {filtered.map((p) => (
              <tr key={p.id}
                className={`border-b border-[#EFEBDF] last:border-0 ${p.statut === "termine" ? "" : "bg-[#FDF8EF]"}`}>
                <td className="px-1 py-1">
                  <input type="date" className={cellText + " bz-mono"} value={p.date || ""}
                    onChange={(e) => update(p.id, { date: e.target.value })} />
                </td>
                <td className="px-1 py-1">
                  <select className={cellSelect} value={p.qualite || qualites[0]}
                    disabled={p.enStock}
                    onChange={(e) => update(p.id, { qualite: e.target.value })}>
                    {qualites.map((q) => <option key={q} value={q}>{q}</option>)}
                  </select>
                </td>
                <td className="px-1 py-1">
                  <input className={cellText} placeholder="ex. bleu, vert, bogolan…" value={p.couleur || ""}
                    disabled={p.enStock}
                    onChange={(e) => update(p.id, { couleur: e.target.value })} />
                </td>
                <td className="px-1 py-1">
                  <input className={cellText} placeholder="Nom du teinturier" value={p.teinturier || ""}
                    onChange={(e) => update(p.id, { teinturier: e.target.value })} />
                </td>
                <td className="px-1 py-1">
                  <input type="number" min="0" step="0.5" className={cellText + " bz-mono text-right"} placeholder="0"
                    value={p.metrage ?? ""} disabled={p.enStock}
                    onChange={(e) => update(p.id, { metrage: e.target.value })} />
                </td>
                <td className="px-1 py-1">
                  <input type="number" min="0" step="1" className={cellText + " bz-mono text-right"} placeholder="0"
                    value={p.prixInitial ?? ""}
                    onChange={(e) => update(p.id, { prixInitial: e.target.value })} />
                </td>
                <td className="px-3 py-1 bz-mono text-right whitespace-nowrap font-medium">{fcfa(totalDe(p))}</td>
                <td className="px-1 py-1">
                  <select
                    className={cellSelect + (p.statut === "termine" ? " text-[#1F6F5C] font-medium" : " text-[#B9832F] font-medium")}
                    value={p.statut || "en_cours"}
                    onChange={(e) => update(p.id, { statut: e.target.value })}>
                    <option value="en_cours">En cours</option>
                    <option value="termine">Terminé</option>
                  </select>
                </td>
                <td className="px-2 py-1 text-xs whitespace-nowrap">
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input type="checkbox" checked={!!p.enStock} onChange={() => basculerStock(p)} />
                    {p.enStock
                      ? <span className="text-[#1F6F5C]">en stock ({p.qteEntree} m) · {nomArticle(p)}</span>
                      : <span className="text-[#5B5F55]">entrer en stock</span>}
                  </label>
                </td>
                <td className="px-1 py-1 text-center">
                  <button onClick={() => remove(p)} title="Supprimer la ligne"
                    className="text-[#C1652F] hover:underline text-sm px-2">✕</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="bz-sans text-xs text-[#9AA0A6] mt-3">
        Le « prix initial » est votre coût de revient par mètre (bazin blanc + teinture). Quand vous cochez « entrer en stock », le métrage est ajouté à un article
        « {"{qualité}"} teint {"{couleur}"} » dans l'onglet Stock (créé automatiquement s'il n'existe pas encore). Décochez pour annuler l'entrée en stock.
      </p>
    </div>
  );
}
