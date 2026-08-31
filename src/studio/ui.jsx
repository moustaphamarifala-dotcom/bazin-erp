import React, { useEffect } from "react";

/* Briques d'interface partagées par le studio. */

export function Bouton({ variante = "neutre", className = "", ...props }) {
  const variantes = {
    principal:
      "bg-[#E0A93B] text-[#14161A] font-semibold hover:bg-[#EFBD52] disabled:bg-[#3A3D45] disabled:text-[#7E838C]",
    neutre:
      "bg-white/5 text-[#E8E6E1] hover:bg-white/10 border border-white/10 disabled:opacity-40",
    discret: "text-[#9AA0A6] hover:text-[#E8E6E1] hover:bg-white/5",
    danger: "text-[#E8837A] hover:bg-[#E8837A]/10 border border-[#E8837A]/30",
  };
  return (
    <button
      {...props}
      className={`st-sans rounded-md px-3 py-2 text-sm transition-colors disabled:cursor-not-allowed ${variantes[variante]} ${className}`}
    />
  );
}

export function Etiquette({ children, action }) {
  return (
    <div className="flex items-baseline justify-between mb-2">
      <span className="st-mono text-[11px] uppercase tracking-[0.14em] text-[#7E838C]">{children}</span>
      {action}
    </div>
  );
}

export function Puce({ actif, children, title, ...props }) {
  return (
    <button
      type="button"
      title={title}
      {...props}
      className={`st-sans rounded-full border px-3 py-1 text-xs transition-colors ${
        actif
          ? "border-[#E0A93B] bg-[#E0A93B]/15 text-[#EFBD52]"
          : "border-white/10 text-[#9AA0A6] hover:border-white/25 hover:text-[#E8E6E1]"
      }`}
    >
      {children}
    </button>
  );
}

export function Alerte({ ton = "erreur", children, onFermer }) {
  const tons = {
    erreur: "border-[#E8837A]/40 bg-[#E8837A]/10 text-[#F0A79F]",
    info: "border-[#E0A93B]/40 bg-[#E0A93B]/10 text-[#EFBD52]",
  };
  return (
    <div className={`st-sans flex items-start gap-3 rounded-md border px-4 py-3 text-sm ${tons[ton]}`}>
      <div className="flex-1">{children}</div>
      {onFermer && (
        <button onClick={onFermer} className="shrink-0 opacity-60 hover:opacity-100" aria-label="Fermer">
          ✕
        </button>
      )}
    </div>
  );
}

/** Boîte de dialogue centrée, fermée par Échap ou par le fond. */
export function Modale({ titre, onFermer, children, largeur = "max-w-lg" }) {
  useEffect(() => {
    const surTouche = (e) => e.key === "Escape" && onFermer();
    window.addEventListener("keydown", surTouche);
    return () => window.removeEventListener("keydown", surTouche);
  }, [onFermer]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      onClick={(e) => e.target === e.currentTarget && onFermer()}
    >
      <div className={`w-full ${largeur} rounded-lg border border-white/10 bg-[#1B1F26] shadow-2xl`}>
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
          <h2 className="st-serif text-lg text-[#E8E6E1]">{titre}</h2>
          <button onClick={onFermer} className="text-[#7E838C] hover:text-[#E8E6E1]" aria-label="Fermer">
            ✕
          </button>
        </div>
        <div className="px-5 py-4">{children}</div>
      </div>
    </div>
  );
}

/** Rectangle miniature illustrant un format d'image. */
export function ApercuFormat({ ratio, actif }) {
  const cote = 16;
  const largeur = ratio >= 1 ? cote : cote * ratio;
  const hauteur = ratio >= 1 ? cote / ratio : cote;
  return (
    <span
      className={`inline-block rounded-[2px] border ${actif ? "border-[#EFBD52]" : "border-current opacity-60"}`}
      style={{ width: largeur, height: hauteur }}
    />
  );
}
