/* Modèles, formats et styles proposés par le studio. */

export const MODELES = [
  {
    id: "gemini-3-pro-image-preview",
    nom: "Nano Banana Pro",
    resume: "Qualité maximale, texte net dans l'image, jusqu'à 4K, 14 références.",
    tailles: ["1K", "2K", "4K"],
    maxReferences: 14,
  },
  {
    id: "gemini-2.5-flash-image",
    nom: "Nano Banana",
    resume: "Rapide et économique, parfait pour itérer avant un rendu Pro.",
    tailles: ["1K", "2K"],
    maxReferences: 3,
  },
];

export const MODELE_DEFAUT = MODELES[0].id;

export const modeleParId = (id) => MODELES.find((m) => m.id === id) || MODELES[0];

/* Formats acceptés par imageConfig.aspectRatio. */
export const FORMATS = [
  { id: "1:1", nom: "Carré", ratio: 1 },
  { id: "4:5", nom: "Portrait doux", ratio: 4 / 5 },
  { id: "3:4", nom: "Portrait", ratio: 3 / 4 },
  { id: "2:3", nom: "Affiche", ratio: 2 / 3 },
  { id: "9:16", nom: "Story / TikTok", ratio: 9 / 16 },
  { id: "5:4", nom: "Paysage doux", ratio: 5 / 4 },
  { id: "4:3", nom: "Paysage", ratio: 4 / 3 },
  { id: "3:2", nom: "Photo", ratio: 3 / 2 },
  { id: "16:9", nom: "Écran large", ratio: 16 / 9 },
  { id: "21:9", nom: "Cinéma", ratio: 21 / 9 },
];

export const formatParId = (id) => FORMATS.find((f) => f.id === id) || FORMATS[0];

export const TAILLES = {
  "1K": "1K · aperçu",
  "2K": "2K · courant",
  "4K": "4K · impression",
};

/* Suffixes ajoutés au prompt. `complement` vide = aucun style imposé. */
export const STYLES = [
  { id: "aucun", nom: "Libre", complement: "" },
  {
    id: "photo",
    nom: "Photo studio",
    complement:
      "photographie de studio, objectif 85 mm, lumière douce en trois points, fond dégradé neutre, netteté élevée, rendu réaliste",
  },
  {
    id: "produit",
    nom: "Packshot produit",
    complement:
      "photographie produit e-commerce, fond blanc uni, éclairage diffus sans ombre dure, cadrage centré, très haute définition",
  },
  {
    id: "cinema",
    nom: "Cinématique",
    complement:
      "image cinématographique, étalonnage contrasté, lumière rasante en clair-obscur, faible profondeur de champ, grain argentique fin",
  },
  {
    id: "editorial",
    nom: "Mode éditoriale",
    complement:
      "photographie de mode éditoriale, pose affirmée, lumière sculptante, palette raffinée, esthétique de magazine",
  },
  {
    id: "illustration",
    nom: "Illustration",
    complement:
      "illustration numérique, traits nets, aplats de couleurs harmonieux, ombres simples, composition lisible",
  },
  {
    id: "aquarelle",
    nom: "Aquarelle",
    complement:
      "aquarelle sur papier grain, pigments transparents, bords humides, réserves de blanc, palette délicate",
  },
  {
    id: "affiche",
    nom: "Affiche graphique",
    complement:
      "affiche graphique, formes géométriques, palette limitée à trois couleurs, typographie forte, style sérigraphie",
  },
  {
    id: "rendu3d",
    nom: "Rendu 3D",
    complement:
      "rendu 3D, matériaux physiquement réalistes, éclairage HDRI, occlusion ambiante douce, finition soignée",
  },
  {
    id: "anime",
    nom: "Anime",
    complement:
      "style anime, contours nets, ombrage cel-shading, couleurs vives, arrière-plan peint",
  },
  {
    id: "croquis",
    nom: "Croquis",
    complement:
      "croquis au crayon graphite sur papier, hachures visibles, valeurs de gris, quelques rehauts",
  },
  {
    id: "neon",
    nom: "Néon nocturne",
    complement:
      "scène nocturne, enseignes néon, reflets sur sol mouillé, brume colorée, contraste marqué",
  },
];

export const styleParId = (id) => STYLES.find((s) => s.id === id) || STYLES[0];

/* Exemples cliquables : quelques-uns sont taillés pour l'activité bazin de
   l'atelier, les autres montrent les points forts du modèle (texte net dans
   l'image, infographie, composition à partir de références). */
export const EXEMPLES = [
  {
    titre: "Portrait bazin",
    prompt:
      "Portrait en pied d'une femme portant un grand boubou en bazin riche indigo brodé de fils dorés, debout dans une cour ensoleillée aux murs ocre, lumière de fin d'après-midi, tissu qui capte la lumière, regard vers l'objectif.",
    format: "3:4",
    style: "editorial",
  },
  {
    titre: "Affiche promo",
    prompt:
      "Affiche promotionnelle pour un atelier de teinture. Fond bleu indigo profond, pièce de bazin damassé drapée, le texte « GRANDE VENTE » en grandes lettres dorées en haut et « −20 % sur tous les bazins » en bas, typographie élégante, lettres parfaitement lisibles.",
    format: "4:5",
    style: "affiche",
  },
  {
    titre: "Packshot tissu",
    prompt:
      "Pile de trois pièces de bazin riche pliées, couleurs bordeaux, vert émeraude et blanc cassé, posées sur fond blanc uni, éclairage doux qui révèle le grain damassé du tissu, vue de trois quarts.",
    format: "1:1",
    style: "produit",
  },
  {
    titre: "Vitrine de boutique",
    prompt:
      "Devanture d'une petite boutique de tissus en Afrique de l'Ouest à l'heure bleue, vitrine éclairée montrant des rouleaux de bazin colorés, enseigne peinte à la main au-dessus de la porte, passants flous en mouvement.",
    format: "16:9",
    style: "cinema",
  },
  {
    titre: "Infographie",
    prompt:
      "Infographie claire expliquant les quatre étapes de la teinture du bazin : trempage, nouage, teinture indigo, tapage au maillet. Quatre panneaux numérotés avec pictogrammes au trait, légendes courtes en français, palette indigo et sable, mise en page aérée.",
    format: "4:5",
    style: "illustration",
  },
  {
    titre: "Carte de visite",
    prompt:
      "Maquette de carte de visite posée sur une surface en lin froissé, papier épais crème, texte « Atelier Bazin » gravé en relief doré, sous-titre « teinture & confection », lumière rasante qui révèle le relief.",
    format: "3:2",
    style: "photo",
  },
];

/* Conseils affichés dans le panneau d'aide. */
export const CONSEILS = [
  "Décrivez une scène plutôt qu'une liste de mots-clés : le modèle comprend les phrases entières.",
  "Précisez le cadrage (gros plan, plan large), la lumière et la matière — ce sont les leviers les plus efficaces.",
  "Pour du texte dans l'image, mettez-le entre guillemets et restez court : « GRANDE VENTE ».",
  "Ajoutez des images de référence pour garder un visage, un produit ou une charte graphique d'une image à l'autre.",
  "Pour retoucher, décrivez seulement ce qui change : « garde tout, remplace le fond par un mur ocre ».",
];
