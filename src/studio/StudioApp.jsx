import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { genererImage, enrichirPrompt, GeminiError } from "./gemini.js";
import {
  listerCreations,
  enregistrerCreation,
  supprimerCreation,
  viderGalerie,
  galerieDisponible,
} from "./db.js";
import {
  base64VersBlob,
  blobVersBase64,
  copierImage,
  estImageAcceptee,
  fichierVersReference,
  telechargerBlob,
} from "./images.js";
import {
  CONSEILS,
  EXEMPLES,
  FORMATS,
  MODELES,
  MODELE_DEFAUT,
  STYLES,
  TAILLES,
  formatParId,
  modeleParId,
  styleParId,
} from "./presets.js";
import { Alerte, ApercuFormat, Bouton, Etiquette, Modale, Puce } from "./ui.jsx";

const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const CLE_API = "studio.cleApi";
/* Au-delà, les créations les plus anciennes sont retirées de la galerie pour
   ne pas saturer le stockage du navigateur. */
const MAX_GALERIE = 120;

/* Une image seule reste centrée et à taille lisible plutôt qu'étirée. */
const grilleResultats = (nombre) =>
  `grid gap-4 ${nombre === 1 ? "mx-auto max-w-xl" : "sm:grid-cols-2"}`;

function lireStockage(cle, defaut) {
  try {
    const brut = localStorage.getItem(cle);
    return brut === null ? defaut : JSON.parse(brut);
  } catch {
    return defaut;
  }
}

/** État persisté dans le localStorage (réglages du studio). */
function usePreference(nom, defaut) {
  const cle = `studio.${nom}`;
  const [valeur, setValeur] = useState(() => lireStockage(cle, defaut));
  useEffect(() => {
    try {
      localStorage.setItem(cle, JSON.stringify(valeur));
    } catch {
      /* stockage indisponible : les réglages ne survivront pas au rechargement */
    }
  }, [cle, valeur]);
  return [valeur, setValeur];
}

export default function StudioApp() {
  /* ---------- Clé API ---------- */
  const [cleApi, setCleApiState] = useState(() => {
    try {
      return localStorage.getItem(CLE_API) || import.meta.env.VITE_GEMINI_API_KEY || "";
    } catch {
      return import.meta.env.VITE_GEMINI_API_KEY || "";
    }
  });
  const definirCleApi = useCallback((valeur) => {
    setCleApiState(valeur);
    try {
      if (valeur) localStorage.setItem(CLE_API, valeur);
      else localStorage.removeItem(CLE_API);
    } catch {
      /* ignoré */
    }
  }, []);

  /* ---------- Réglages ---------- */
  const [modeleId, setModeleId] = usePreference("modele", MODELE_DEFAUT);
  const [format, setFormat] = usePreference("format", "1:1");
  const [taille, setTaille] = usePreference("taille", "2K");
  const [nombre, setNombre] = usePreference("nombre", 1);
  const [styleId, setStyleId] = usePreference("style", "aucun");
  const modele = modeleParId(modeleId);
  const tailleEffective = modele.tailles.includes(taille) ? taille : modele.tailles[modele.tailles.length - 1];

  /* ---------- Saisie ---------- */
  const [prompt, setPrompt] = useState("");
  const [promptPrecedent, setPromptPrecedent] = useState(null);
  const [references, setReferences] = useState([]);
  const champPromptRef = useRef(null);

  /* ---------- Production ---------- */
  const [creations, setCreations] = useState([]);
  const [derniers, setDerniers] = useState([]);
  const [enCours, setEnCours] = useState(false);
  const [enrichissement, setEnrichissement] = useState(false);
  const [erreur, setErreur] = useState("");
  const [avis, setAvis] = useState("");
  const [persistance, setPersistance] = useState(true);
  const controleurRef = useRef(null);
  /* Miroir de `creations` : la génération est asynchrone et la liste peut
     changer pendant l'attente (suppression par l'utilisateur). */
  const creationsRef = useRef([]);
  useEffect(() => {
    creationsRef.current = creations;
  }, [creations]);

  /* ---------- Navigation ---------- */
  const [vue, setVue] = useState("creation");
  const [modaleCle, setModaleCle] = useState(false);
  const [modaleAide, setModaleAide] = useState(false);
  const [visionneuse, setVisionneuse] = useState(null);
  const [survolDepot, setSurvolDepot] = useState(false);

  /* Les URL d'objet sont créées une fois par création et libérées à la
     suppression ou au démontage. */
  const urlsRef = useRef(new Set());
  const creerUrl = useCallback((blob) => {
    const url = URL.createObjectURL(blob);
    urlsRef.current.add(url);
    return url;
  }, []);
  const libererUrl = useCallback((url) => {
    if (!url) return;
    urlsRef.current.delete(url);
    URL.revokeObjectURL(url);
  }, []);
  useEffect(() => {
    const urls = urlsRef.current;
    return () => urls.forEach((url) => URL.revokeObjectURL(url));
  }, []);

  /* ---------- Chargement de la galerie ---------- */
  useEffect(() => {
    let annule = false;
    (async () => {
      if (!(await galerieDisponible())) {
        if (!annule) setPersistance(false);
        return;
      }
      try {
        const items = await listerCreations();
        if (!annule) setCreations(items.map((item) => ({ ...item, url: creerUrl(item.blob) })));
      } catch {
        if (!annule) setPersistance(false);
      }
    })();
    return () => {
      annule = true;
    };
  }, [creerUrl]);

  /* ---------- Références ---------- */
  const placesReferences = modele.maxReferences - references.length;

  const ajouterFichiers = useCallback(
    async (fichiers) => {
      const liste = Array.from(fichiers || []);
      if (!liste.length) return;
      const images = liste.filter(estImageAcceptee);
      const retenus = images.slice(0, Math.max(0, placesReferences));

      if (!retenus.length) {
        setErreur(
          images.length
            ? `Ce modèle accepte au maximum ${modele.maxReferences} image(s) de référence.`
            : "Formats acceptés : PNG, JPEG et WebP."
        );
        return;
      }
      try {
        const ajouts = await Promise.all(
          retenus.map(async (fichier) => ({
            id: uid(),
            nom: fichier.name,
            origine: "fichier",
            ...(await fichierVersReference(fichier)),
          }))
        );
        setReferences((actuelles) => [...actuelles, ...ajouts]);
        if (retenus.length < images.length) {
          setAvis(`${images.length - retenus.length} image(s) ignorée(s) : limite de ${modele.maxReferences} atteinte.`);
        }
      } catch (err) {
        setErreur(err.message || "Impossible de lire ces images.");
      }
    },
    [modele.maxReferences, placesReferences]
  );

  /* Coller une image depuis le presse-papiers. */
  useEffect(() => {
    const surCollage = (e) => {
      const fichiers = Array.from(e.clipboardData?.files || []);
      if (fichiers.length) {
        e.preventDefault();
        ajouterFichiers(fichiers);
      }
    };
    window.addEventListener("paste", surCollage);
    return () => window.removeEventListener("paste", surCollage);
  }, [ajouterFichiers]);

  const retirerReference = (id) => setReferences((r) => r.filter((ref) => ref.id !== id));

  /* Les moteurs n'acceptent pas le même nombre de références : on ajuste au
     changement plutôt que d'envoyer une requête que l'API refusera. */
  const changerModele = (id) => {
    const cible = modeleParId(id);
    setModeleId(id);
    if (references.length > cible.maxReferences) {
      setReferences(references.slice(0, cible.maxReferences));
      setAvis(
        `${references.length - cible.maxReferences} référence(s) retirée(s) : ${cible.nom} en accepte ${cible.maxReferences}.`
      );
    }
  };

  const reprendre = async (creation) => {
    if (placesReferences <= 0) {
      setErreur(`Ce modèle accepte au maximum ${modele.maxReferences} image(s) de référence.`);
      return;
    }
    try {
      const data = await blobVersBase64(creation.blob);
      setReferences((r) => [
        ...r,
        {
          id: uid(),
          nom: "Création reprise",
          origine: "creation",
          mimeType: creation.mimeType,
          data,
          apercu: creation.url,
        },
      ]);
      setVue("creation");
      setVisionneuse(null);
      champPromptRef.current?.focus();
    } catch (err) {
      setErreur(err.message || "Impossible de reprendre cette image.");
    }
  };

  /* ---------- Génération ---------- */
  const promptComplet = useMemo(() => {
    const complement = styleParId(styleId).complement;
    return [prompt.trim(), complement].filter(Boolean).join(". ");
  }, [prompt, styleId]);

  async function generer() {
    if (!cleApi) {
      setModaleCle(true);
      return;
    }
    if (!prompt.trim()) {
      setErreur(
        references.length
          ? "Décrivez la modification à appliquer aux images de référence."
          : "Décrivez l'image à générer."
      );
      champPromptRef.current?.focus();
      return;
    }

    const parts = [
      ...references.map((ref) => ({ inlineData: { mimeType: ref.mimeType, data: ref.data } })),
      { text: promptComplet },
    ];
    const contents = [{ role: "user", parts }];

    const controleur = new AbortController();
    controleurRef.current = controleur;
    setEnCours(true);
    setErreur("");
    setAvis("");
    setVue("creation");

    const reglements = await Promise.allSettled(
      Array.from({ length: nombre }, () =>
        genererImage({
          apiKey: cleApi,
          model: modele.id,
          contents,
          aspectRatio: format,
          imageSize: tailleEffective,
          signal: controleur.signal,
        })
      )
    );

    controleurRef.current = null;
    setEnCours(false);

    if (controleur.signal.aborted) {
      setAvis("Génération interrompue.");
      return;
    }

    const reussites = reglements.filter((r) => r.status === "fulfilled");
    const echecs = reglements.filter((r) => r.status === "rejected");

    if (!reussites.length) {
      const cause = echecs[0]?.reason;
      setErreur(
        cause instanceof GeminiError || cause instanceof Error
          ? cause.message
          : "La génération a échoué."
      );
      return;
    }
    if (echecs.length) {
      setAvis(`${echecs.length} image(s) sur ${nombre} n'ont pas abouti : ${echecs[0].reason?.message || ""}`);
    }

    const nouvelles = [];
    reussites.forEach(({ value }) => {
      value.images.forEach((image) => {
        const blob = base64VersBlob(image.data, image.mimeType);
        nouvelles.push({
          id: uid(),
          creeLe: new Date().toISOString(),
          prompt: prompt.trim(),
          promptComplet,
          modele: modele.id,
          format,
          taille: tailleEffective,
          styleId,
          nbReferences: references.length,
          mimeType: image.mimeType,
          texte: value.texte,
          blob,
          url: creerUrl(blob),
        });
      });
    });

    const fusion = [...nouvelles, ...creationsRef.current];
    fusion.slice(MAX_GALERIE).forEach((item) => {
      libererUrl(item.url);
      supprimerCreation(item.id).catch(() => {});
    });
    setDerniers(nouvelles.map((n) => n.id));
    setCreations(fusion.slice(0, MAX_GALERIE));

    if (persistance) {
      /* La persistance est un confort : un échec ne doit pas masquer le
         résultat déjà affiché. */
      Promise.all(
        nouvelles.map(({ url, ...aStocker }) => enregistrerCreation(aStocker))
      ).catch(() => setPersistance(false));
    }
  }

  function interrompre() {
    controleurRef.current?.abort();
    controleurRef.current = null;
    setEnCours(false);
  }

  async function enrichir() {
    if (!cleApi) {
      setModaleCle(true);
      return;
    }
    if (!prompt.trim() || enrichissement) return;
    setEnrichissement(true);
    setErreur("");
    try {
      const enrichi = await enrichirPrompt({ apiKey: cleApi, prompt: prompt.trim() });
      setPromptPrecedent(prompt);
      setPrompt(enrichi);
    } catch (err) {
      setErreur(err.message || "L'amélioration du prompt a échoué.");
    } finally {
      setEnrichissement(false);
    }
  }

  /* ---------- Actions sur les créations ---------- */
  const supprimer = (creation) => {
    libererUrl(creation.url);
    setCreations((c) => c.filter((item) => item.id !== creation.id));
    setDerniers((d) => d.filter((id) => id !== creation.id));
    setVisionneuse((v) => (v?.id === creation.id ? null : v));
    supprimerCreation(creation.id).catch(() => {});
  };

  const toutVider = async () => {
    creations.forEach((item) => libererUrl(item.url));
    setCreations([]);
    setDerniers([]);
    setVisionneuse(null);
    try {
      await viderGalerie();
    } catch {
      /* rien à vider */
    }
  };

  const copier = async (creation) => {
    try {
      await copierImage(creation.blob);
      setAvis("Image copiée dans le presse-papiers.");
    } catch (err) {
      setErreur(err.message);
    }
  };

  const appliquerExemple = (exemple) => {
    setPrompt(exemple.prompt);
    setFormat(exemple.format);
    setStyleId(exemple.style);
    setPromptPrecedent(null);
    champPromptRef.current?.focus();
  };

  const affichees = vue === "galerie" ? creations : creations.filter((c) => derniers.includes(c.id));

  /* ---------- Rendu ---------- */
  return (
    <div
      /* Sur grand écran, la fenêtre est figée et chaque colonne défile seule ;
         sur mobile, la page défile normalement. */
      className="flex min-h-screen flex-col bg-[#14161A] text-[#E8E6E1] lg:h-screen lg:min-h-0 lg:overflow-hidden"
      onDragOver={(e) => {
        e.preventDefault();
        setSurvolDepot(true);
      }}
      onDragLeave={(e) => {
        if (e.currentTarget === e.target) setSurvolDepot(false);
      }}
      onDrop={(e) => {
        e.preventDefault();
        setSurvolDepot(false);
        ajouterFichiers(e.dataTransfer.files);
      }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,600&family=Inter:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap');
        /* Polices de repli explicites : la page reste lisible si Google Fonts
           est inaccessible (hors ligne, réseau filtré). */
        .st-serif { font-family: 'Fraunces', Georgia, 'Times New Roman', serif; }
        .st-sans { font-family: 'Inter', system-ui, -apple-system, 'Segoe UI', sans-serif; }
        .st-mono { font-family: 'IBM Plex Mono', ui-monospace, Menlo, Consolas, monospace; }
        .st-damier {
          background-image: linear-gradient(45deg, #22262E 25%, transparent 25%),
            linear-gradient(-45deg, #22262E 25%, transparent 25%),
            linear-gradient(45deg, transparent 75%, #22262E 75%),
            linear-gradient(-45deg, transparent 75%, #22262E 75%);
          background-size: 16px 16px;
          background-position: 0 0, 0 8px, 8px -8px, -8px 0px;
        }
        @keyframes st-pulse { 0%, 100% { opacity: .35 } 50% { opacity: .7 } }
        .st-attente { animation: st-pulse 1.6s ease-in-out infinite; }
      `}</style>

      {survolDepot && (
        <div className="pointer-events-none fixed inset-0 z-40 flex items-center justify-center border-4 border-dashed border-[#E0A93B] bg-[#14161A]/80">
          <p className="st-serif text-2xl text-[#EFBD52]">Déposez vos images de référence</p>
        </div>
      )}

      {/* ---------- En-tête ---------- */}
      <header className="flex shrink-0 flex-wrap items-center gap-4 border-b border-white/10 px-6 py-4">
        <div className="flex-1 min-w-[200px]">
          <h1 className="st-serif text-xl tracking-tight">
            Studio <span className="text-[#E0A93B]">Images</span>
          </h1>
          <p className="st-mono mt-0.5 text-[11px] text-[#7E838C]">
            Génération et retouche d'images — moteur Gemini
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-md border border-white/10 p-0.5">
            {[
              ["creation", "Création"],
              ["galerie", `Galerie${creations.length ? ` (${creations.length})` : ""}`],
            ].map(([id, label]) => (
              <button
                key={id}
                onClick={() => setVue(id)}
                className={`st-sans rounded px-3 py-1.5 text-sm transition-colors ${
                  vue === id ? "bg-white/10 text-[#E8E6E1]" : "text-[#9AA0A6] hover:text-[#E8E6E1]"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <Bouton variante="discret" onClick={() => setModaleAide(true)}>
            Aide
          </Bouton>
          <Bouton variante="neutre" onClick={() => setModaleCle(true)}>
            <span
              className={`mr-2 inline-block h-2 w-2 rounded-full align-middle ${
                cleApi ? "bg-[#7BC47F]" : "bg-[#E8837A]"
              }`}
            />
            Clé API
          </Bouton>
          <a
            href="./index.html"
            className="st-sans rounded-md px-3 py-2 text-sm text-[#7E838C] transition-colors hover:text-[#E8E6E1]"
          >
            Bazin ERP →
          </a>
        </div>
      </header>

      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        {/* ---------- Réglages ---------- */}
        <aside className="w-full shrink-0 space-y-6 overflow-y-auto border-b border-white/10 p-5 lg:w-[380px] lg:border-b-0 lg:border-r">
          <section>
            <Etiquette
              action={
                promptPrecedent !== null && (
                  <button
                    onClick={() => {
                      setPrompt(promptPrecedent);
                      setPromptPrecedent(null);
                    }}
                    className="st-sans text-[11px] text-[#7E838C] hover:text-[#E8E6E1]"
                  >
                    Revenir au prompt initial
                  </button>
                )
              }
            >
              Description
            </Etiquette>
            <textarea
              ref={champPromptRef}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={(e) => {
                if ((e.metaKey || e.ctrlKey) && e.key === "Enter") generer();
              }}
              rows={6}
              placeholder={
                references.length
                  ? "Décrivez la modification : « garde le vêtement, remplace le fond par un mur ocre »"
                  : "Décrivez la scène : sujet, cadrage, lumière, matières, ambiance…"
              }
              className="st-sans w-full resize-y rounded-md border border-white/10 bg-[#1B1F26] px-3 py-2.5 text-sm leading-relaxed text-[#E8E6E1] placeholder:text-[#5E636B] focus:border-[#E0A93B]/60 focus:outline-none"
            />
            <div className="mt-2 flex items-center justify-between">
              <Bouton variante="discret" onClick={enrichir} disabled={enrichissement || !prompt.trim()}>
                {enrichissement ? "Amélioration…" : "✦ Améliorer le prompt"}
              </Bouton>
              <span className="st-mono text-[11px] text-[#5E636B]">{prompt.length} car.</span>
            </div>
          </section>

          <section>
            <Etiquette>Style</Etiquette>
            <div className="flex flex-wrap gap-1.5">
              {STYLES.map((style) => (
                <Puce key={style.id} actif={styleId === style.id} onClick={() => setStyleId(style.id)}>
                  {style.nom}
                </Puce>
              ))}
            </div>
          </section>

          <ZoneReferences
            references={references}
            maxReferences={modele.maxReferences}
            onAjouter={ajouterFichiers}
            onRetirer={retirerReference}
          />

          <section>
            <Etiquette>Format</Etiquette>
            <div className="flex flex-wrap gap-1.5">
              {FORMATS.map((f) => (
                <Puce key={f.id} actif={format === f.id} onClick={() => setFormat(f.id)} title={f.nom}>
                  <span className="flex items-center gap-1.5">
                    <ApercuFormat ratio={f.ratio} actif={format === f.id} />
                    {f.id}
                  </span>
                </Puce>
              ))}
            </div>
          </section>

          <section className="grid grid-cols-2 gap-4">
            <div>
              <Etiquette>Définition</Etiquette>
              <select
                value={tailleEffective}
                onChange={(e) => setTaille(e.target.value)}
                className="st-sans w-full rounded-md border border-white/10 bg-[#1B1F26] px-3 py-2 text-sm focus:border-[#E0A93B]/60 focus:outline-none"
              >
                {modele.tailles.map((t) => (
                  <option key={t} value={t} className="bg-[#1B1F26]">
                    {TAILLES[t]}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Etiquette>Nombre</Etiquette>
              <div className="flex gap-1.5">
                {[1, 2, 3, 4].map((n) => (
                  <Puce key={n} actif={nombre === n} onClick={() => setNombre(n)}>
                    {n}
                  </Puce>
                ))}
              </div>
            </div>
          </section>

          <section>
            <Etiquette>Moteur</Etiquette>
            <div className="space-y-2">
              {MODELES.map((m) => (
                <button
                  key={m.id}
                  onClick={() => changerModele(m.id)}
                  className={`block w-full rounded-md border px-3 py-2.5 text-left transition-colors ${
                    modeleId === m.id
                      ? "border-[#E0A93B]/60 bg-[#E0A93B]/10"
                      : "border-white/10 hover:border-white/25"
                  }`}
                >
                  <div className="st-sans text-sm font-medium text-[#E8E6E1]">{m.nom}</div>
                  <div className="st-sans mt-0.5 text-xs leading-snug text-[#7E838C]">{m.resume}</div>
                </button>
              ))}
            </div>
          </section>

          <section>
            <Etiquette>Exemples</Etiquette>
            <div className="flex flex-wrap gap-1.5">
              {EXEMPLES.map((exemple) => (
                <Puce key={exemple.titre} onClick={() => appliquerExemple(exemple)}>
                  {exemple.titre}
                </Puce>
              ))}
            </div>
          </section>
        </aside>

        {/* ---------- Résultats ---------- */}
        <main className="min-h-0 flex-1 overflow-y-auto p-6">
          <div className="mx-auto max-w-5xl space-y-4">
            {erreur && (
              <Alerte onFermer={() => setErreur("")}>{erreur}</Alerte>
            )}
            {avis && (
              <Alerte ton="info" onFermer={() => setAvis("")}>
                {avis}
              </Alerte>
            )}
            {!persistance && (
              <Alerte ton="info">
                Ce navigateur refuse le stockage local : les images resteront affichées mais seront perdues
                au rechargement de la page. Pensez à les télécharger.
              </Alerte>
            )}

            {vue === "galerie" && creations.length > 0 && (
              <div className="flex items-center justify-between">
                <p className="st-sans text-sm text-[#7E838C]">
                  {creations.length} création{creations.length > 1 ? "s" : ""} conservée
                  {creations.length > 1 ? "s" : ""} dans ce navigateur.
                </p>
                <Bouton variante="danger" onClick={toutVider}>
                  Vider la galerie
                </Bouton>
              </div>
            )}

            {enCours && (
              <div className={grilleResultats(nombre)}>
                {Array.from({ length: nombre }, (_, i) => (
                  <div
                    key={i}
                    className="st-attente st-damier flex items-center justify-center rounded-lg border border-white/10"
                    style={{ aspectRatio: format.replace(":", "/") }}
                  >
                    <span className="st-mono text-xs text-[#9AA0A6]">rendu en cours…</span>
                  </div>
                ))}
              </div>
            )}

            {!enCours && affichees.length === 0 && (
              <EtatVide
                vue={vue}
                onExemple={() => appliquerExemple(EXEMPLES[0])}
                onGalerie={() => setVue("galerie")}
                aDesCreations={creations.length > 0}
              />
            )}

            {affichees.length > 0 && (
              <div className={grilleResultats(affichees.length)}>
                {affichees.map((creation) => (
                  <CarteCreation
                    key={creation.id}
                    creation={creation}
                    onOuvrir={() => setVisionneuse(creation)}
                    onReprendre={() => reprendre(creation)}
                    onTelecharger={() => telechargerBlob(creation.blob, creation.prompt, creation.mimeType)}
                    onCopier={() => copier(creation)}
                    onSupprimer={() => supprimer(creation)}
                  />
                ))}
              </div>
            )}
          </div>
        </main>
      </div>

      {/* ---------- Barre d'action ---------- */}
      <footer className="sticky bottom-0 shrink-0 border-t border-white/10 bg-[#14161A]/95 px-6 py-3 backdrop-blur">
        <div className="flex flex-wrap items-center gap-3">
          <div className="st-mono flex-1 text-[11px] text-[#5E636B]">
            {modele.nom} · {format} · {tailleEffective} · {nombre} image{nombre > 1 ? "s" : ""}
            {references.length > 0 && ` · ${references.length} référence${references.length > 1 ? "s" : ""}`}
          </div>
          {/* Les clés distinctes évitent que React réutilise le même nœud :
              sans elles, la couleur du bouton s'anime au lieu de basculer. */}
          {enCours ? (
            <Bouton key="interrompre" variante="neutre" onClick={interrompre}>
              Interrompre
            </Bouton>
          ) : (
            <Bouton key="generer" variante="principal" onClick={generer} className="px-6 py-2.5">
              {references.length ? "Retoucher" : "Générer"}
              <span className="st-mono ml-2 text-[11px] opacity-60">Ctrl ↵</span>
            </Bouton>
          )}
        </div>
      </footer>

      {modaleCle && (
        <ModaleCleApi cleActuelle={cleApi} onEnregistrer={definirCleApi} onFermer={() => setModaleCle(false)} />
      )}
      {modaleAide && <ModaleAide onFermer={() => setModaleAide(false)} />}
      {visionneuse && (
        <Visionneuse
          creation={visionneuse}
          liste={affichees}
          onNaviguer={setVisionneuse}
          onFermer={() => setVisionneuse(null)}
          onReprendre={() => reprendre(visionneuse)}
          onTelecharger={() => telechargerBlob(visionneuse.blob, visionneuse.prompt, visionneuse.mimeType)}
        />
      )}
    </div>
  );
}

/* ---------- Zone des images de référence ---------- */
function ZoneReferences({ references, maxReferences, onAjouter, onRetirer }) {
  const champRef = useRef(null);
  return (
    <section>
      <Etiquette
        action={
          <span className="st-mono text-[11px] text-[#5E636B]">
            {references.length}/{maxReferences}
          </span>
        }
      >
        Images de référence
      </Etiquette>

      <div className="flex flex-wrap gap-2">
        {references.map((ref) => (
          <div key={ref.id} className="group relative h-20 w-20 overflow-hidden rounded-md border border-white/10">
            <img src={ref.apercu} alt={ref.nom} className="h-full w-full object-cover" />
            <button
              onClick={() => onRetirer(ref.id)}
              className="absolute right-1 top-1 hidden h-5 w-5 items-center justify-center rounded-full bg-black/70 text-xs text-white group-hover:flex"
              aria-label="Retirer cette référence"
            >
              ✕
            </button>
            {ref.origine === "creation" && (
              <span className="st-mono absolute bottom-0 left-0 right-0 bg-black/70 px-1 py-0.5 text-center text-[9px] text-[#EFBD52]">
                reprise
              </span>
            )}
          </div>
        ))}

        {references.length < maxReferences && (
          <button
            onClick={() => champRef.current?.click()}
            className="st-sans flex h-20 w-20 flex-col items-center justify-center gap-1 rounded-md border border-dashed border-white/20 text-[#7E838C] transition-colors hover:border-[#E0A93B]/60 hover:text-[#EFBD52]"
          >
            <span className="text-lg leading-none">+</span>
            <span className="text-[10px]">Ajouter</span>
          </button>
        )}
      </div>

      <p className="st-sans mt-2 text-[11px] leading-snug text-[#5E636B]">
        Glissez-déposez ou collez des images pour garder un visage, un produit ou une charte d'une image à
        l'autre.
      </p>

      <input
        ref={champRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        multiple
        hidden
        onChange={(e) => {
          onAjouter(e.target.files);
          e.target.value = "";
        }}
      />
    </section>
  );
}

/* ---------- Carte d'une image produite ---------- */
function CarteCreation({ creation, onOuvrir, onReprendre, onTelecharger, onCopier, onSupprimer }) {
  return (
    <figure className="overflow-hidden rounded-lg border border-white/10 bg-[#1B1F26]">
      <button onClick={onOuvrir} className="st-damier block w-full" title="Agrandir">
        <img
          src={creation.url}
          alt={creation.prompt}
          loading="lazy"
          className="w-full"
          style={{ aspectRatio: creation.format.replace(":", "/"), objectFit: "cover" }}
        />
      </button>
      <figcaption className="space-y-2 p-3">
        <p className="st-sans line-clamp-2 text-xs leading-snug text-[#9AA0A6]" title={creation.prompt}>
          {creation.prompt}
        </p>
        <div className="st-mono flex flex-wrap gap-1.5 text-[10px] text-[#5E636B]">
          <span>{modeleParId(creation.modele).nom}</span>
          <span>·</span>
          <span>{creation.format}</span>
          <span>·</span>
          <span>{creation.taille}</span>
        </div>
        <div className="flex flex-wrap gap-1">
          <Bouton variante="discret" onClick={onTelecharger}>
            Télécharger
          </Bouton>
          <Bouton variante="discret" onClick={onReprendre} title="Utiliser comme référence pour retoucher">
            Reprendre
          </Bouton>
          <Bouton variante="discret" onClick={onCopier}>
            Copier
          </Bouton>
          <Bouton variante="discret" onClick={onSupprimer} className="ml-auto hover:text-[#E8837A]">
            Supprimer
          </Bouton>
        </div>
      </figcaption>
    </figure>
  );
}

/* ---------- Écran vide ---------- */
function EtatVide({ vue, onExemple, onGalerie, aDesCreations }) {
  if (vue === "galerie") {
    return (
      <div className="rounded-lg border border-dashed border-white/10 px-6 py-16 text-center">
        <p className="st-serif text-lg text-[#9AA0A6]">La galerie est vide</p>
        <p className="st-sans mt-2 text-sm text-[#5E636B]">
          Les images générées y sont conservées automatiquement, dans ce navigateur.
        </p>
      </div>
    );
  }
  return (
    <div className="rounded-lg border border-dashed border-white/10 px-6 py-16 text-center">
      <p className="st-serif text-xl text-[#E8E6E1]">Décrivez l'image que vous voulez</p>
      <p className="st-sans mx-auto mt-2 max-w-md text-sm leading-relaxed text-[#7E838C]">
        Une phrase suffit pour commencer. Ajoutez des images de référence pour retoucher un visuel existant
        ou garder un produit identique d'une image à l'autre.
      </p>
      <div className="mt-5 flex flex-wrap justify-center gap-2">
        <Bouton variante="neutre" onClick={onExemple}>
          Charger un exemple
        </Bouton>
        {aDesCreations && (
          <Bouton variante="discret" onClick={onGalerie}>
            Voir la galerie
          </Bouton>
        )}
      </div>
    </div>
  );
}

/* ---------- Visionneuse plein écran ---------- */
function Visionneuse({ creation, liste, onNaviguer, onFermer, onReprendre, onTelecharger }) {
  const index = liste.findIndex((item) => item.id === creation.id);

  useEffect(() => {
    const surTouche = (e) => {
      if (e.key === "Escape") onFermer();
      if (e.key === "ArrowRight" && index < liste.length - 1) onNaviguer(liste[index + 1]);
      if (e.key === "ArrowLeft" && index > 0) onNaviguer(liste[index - 1]);
    };
    window.addEventListener("keydown", surTouche);
    return () => window.removeEventListener("keydown", surTouche);
  }, [index, liste, onFermer, onNaviguer]);

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-black/90"
      onClick={(e) => e.target === e.currentTarget && onFermer()}
    >
      <div className="flex items-center justify-end gap-2 p-4">
        <Bouton variante="neutre" onClick={onTelecharger}>
          Télécharger
        </Bouton>
        <Bouton variante="neutre" onClick={onReprendre}>
          Reprendre
        </Bouton>
        <Bouton variante="discret" onClick={onFermer}>
          Fermer ✕
        </Bouton>
      </div>

      <div className="flex min-h-0 flex-1 items-center justify-center gap-3 px-4">
        <Bouton
          variante="discret"
          onClick={() => onNaviguer(liste[index - 1])}
          disabled={index <= 0}
          className="shrink-0"
        >
          ‹
        </Bouton>
        <img src={creation.url} alt={creation.prompt} className="max-h-full max-w-full object-contain" />
        <Bouton
          variante="discret"
          onClick={() => onNaviguer(liste[index + 1])}
          disabled={index < 0 || index >= liste.length - 1}
          className="shrink-0"
        >
          ›
        </Bouton>
      </div>

      <div className="mx-auto w-full max-w-3xl p-4 text-center">
        <p className="st-sans text-sm text-[#9AA0A6]">{creation.prompt}</p>
        <p className="st-mono mt-1 text-[11px] text-[#5E636B]">
          {modeleParId(creation.modele).nom} · {creation.format} · {creation.taille} ·{" "}
          {formatParId(creation.format).nom}
        </p>
      </div>
    </div>
  );
}

/* ---------- Clé API ---------- */
function ModaleCleApi({ cleActuelle, onEnregistrer, onFermer }) {
  const [valeur, setValeur] = useState(cleActuelle);
  const [visible, setVisible] = useState(false);

  return (
    <Modale titre="Clé API Gemini" onFermer={onFermer}>
      <p className="st-sans text-sm leading-relaxed text-[#9AA0A6]">
        Le studio appelle l'API Gemini directement depuis votre navigateur. Créez une clé gratuite sur{" "}
        <a
          href="https://aistudio.google.com/apikey"
          target="_blank"
          rel="noreferrer"
          className="text-[#EFBD52] underline underline-offset-2"
        >
          aistudio.google.com/apikey
        </a>
        , puis collez-la ci-dessous.
      </p>

      <div className="mt-4 flex gap-2">
        <input
          type={visible ? "text" : "password"}
          value={valeur}
          onChange={(e) => setValeur(e.target.value.trim())}
          placeholder="AIza…"
          autoFocus
          className="st-mono flex-1 rounded-md border border-white/10 bg-[#14161A] px-3 py-2 text-sm focus:border-[#E0A93B]/60 focus:outline-none"
        />
        <Bouton variante="neutre" onClick={() => setVisible((v) => !v)}>
          {visible ? "Masquer" : "Afficher"}
        </Bouton>
      </div>

      <p className="st-sans mt-3 text-xs leading-relaxed text-[#5E636B]">
        La clé est enregistrée dans le stockage local de ce navigateur et n'est envoyée qu'à Google. Sur un
        poste partagé, retirez-la après usage. Une clé exposée côté navigateur reste consultable par
        quiconque utilise cet ordinateur : n'utilisez pas une clé rattachée à un projet sensible.
      </p>

      <div className="mt-5 flex justify-between">
        <Bouton
          variante="danger"
          onClick={() => {
            onEnregistrer("");
            onFermer();
          }}
          disabled={!cleActuelle}
        >
          Retirer la clé
        </Bouton>
        <Bouton
          variante="principal"
          onClick={() => {
            onEnregistrer(valeur);
            onFermer();
          }}
        >
          Enregistrer
        </Bouton>
      </div>
    </Modale>
  );
}

/* ---------- Aide ---------- */
function ModaleAide({ onFermer }) {
  return (
    <Modale titre="Écrire un bon prompt" onFermer={onFermer} largeur="max-w-2xl">
      <ul className="space-y-3">
        {CONSEILS.map((conseil) => (
          <li key={conseil} className="st-sans flex gap-3 text-sm leading-relaxed text-[#9AA0A6]">
            <span className="text-[#E0A93B]">—</span>
            <span>{conseil}</span>
          </li>
        ))}
      </ul>

      <div className="mt-5 border-t border-white/10 pt-4">
        <h3 className="st-mono text-[11px] uppercase tracking-[0.14em] text-[#7E838C]">Raccourcis</h3>
        <ul className="st-sans mt-2 space-y-1 text-sm text-[#9AA0A6]">
          <li>
            <span className="st-mono text-[#E8E6E1]">Ctrl/⌘ + Entrée</span> — lancer la génération
          </li>
          <li>
            <span className="st-mono text-[#E8E6E1]">Ctrl/⌘ + V</span> — coller une image de référence
          </li>
          <li>
            <span className="st-mono text-[#E8E6E1]">← →</span> — parcourir les images en plein écran
          </li>
        </ul>
      </div>

      <p className="st-sans mt-5 border-t border-white/10 pt-4 text-xs leading-relaxed text-[#5E636B]">
        Les images produites par Gemini portent un filigrane invisible SynthID qui permet de les identifier
        comme générées par une IA. Vérifiez les droits avant tout usage commercial.
      </p>
    </Modale>
  );
}
