# Bazin ERP

Deux applications dans un même projet, toutes deux entièrement côté navigateur :

| Page | Adresse | Rôle |
| --- | --- | --- |
| Registre de gestion | `index.html` | clients, fournisseurs, stock, factures et devis |
| Studio Images | `studio.html` | génération et retouche d'images par IA |

## Registre de gestion — fonctionnalités

- **Tableau de bord** : statistiques, chiffre d'affaires encaissé sur 6 mois,
  factures en retard avec relance par email, alertes de stock bas.
- **Clients & fournisseurs** : fiches complètes, recherche, export CSV.
- **Stock** : quantités, prix unitaires, seuils d'alerte, lien fournisseur.
- **Factures & devis** : numérotation automatique, lignes reprises depuis le
  stock, statuts (en attente / envoyé / payé), impression au format A4 (PDF via
  la boîte de dialogue d'impression du navigateur).

Les données sont enregistrées localement dans le navigateur (localStorage) —
aucun serveur n'est requis.

## Studio Images

Générateur d'images à partir d'une description, dans l'esprit de Nano Banana
Pro. Accessible depuis le lien « Studio Images » de la barre latérale du
registre, ou directement sur `studio.html`.

- **Génération** : description libre, 12 styles prêts à l'emploi, 10 formats
  (du carré au 21:9), définitions 1K / 2K / 4K, 1 à 4 images par lot.
- **Retouche et cohérence** : jusqu'à 14 images de référence (glisser-déposer,
  copier-coller ou sélection de fichiers) pour modifier un visuel existant ou
  garder un visage, un produit ou une charte d'une image à l'autre. Le bouton
  « Reprendre » renvoie une image produite en entrée de la génération suivante.
- **Amélioration du prompt** : une description courte est réécrite en brief
  détaillé par un modèle texte, avec retour possible à la version initiale.
- **Galerie** : les images restent dans le navigateur (IndexedDB), avec
  téléchargement, copie et visionneuse plein écran.

### Clé API

Le studio appelle l'API Gemini directement depuis le navigateur. Créez une clé
sur [aistudio.google.com/apikey](https://aistudio.google.com/apikey), puis
collez-la via le bouton « Clé API ». Elle est enregistrée dans le stockage local
de ce navigateur et n'est transmise qu'à Google.

Une clé utilisée côté navigateur est visible par quiconque a accès à cet
ordinateur : n'employez pas une clé rattachée à un projet sensible, et retirez-la
après usage sur un poste partagé.

Pour le développement, la variable d'environnement `VITE_GEMINI_API_KEY` sert de
valeur par défaut. Attention : Vite l'inscrit en clair dans le bundle produit, ne
l'utilisez donc jamais pour un déploiement public.

Moteurs disponibles : `gemini-3-pro-image-preview` (Nano Banana Pro) et
`gemini-2.5-flash-image` (Nano Banana). Les images produites portent un
filigrane invisible SynthID.

## Démarrage

```bash
npm install
npm run dev       # serveur de développement
npm run build     # build de production dans dist/ (les deux pages)
npm run preview   # prévisualiser le build
```

En développement, le studio est servi sur `http://localhost:5173/studio.html`.

## Pile technique

- [React 18](https://react.dev/) + [Vite](https://vite.dev/) en build
  multi-pages
- [Tailwind CSS 4](https://tailwindcss.com/)
- [Recharts](https://recharts.org/) pour le graphique du tableau de bord
- [API Gemini](https://ai.google.dev/) pour le studio d'images

## Organisation des sources

```
src/BazinApp.jsx      registre de gestion
src/studio/           studio d'images
  StudioApp.jsx       écran principal et état
  gemini.js           appels à l'API Gemini
  db.js               galerie persistante (IndexedDB)
  images.js           conversions, réduction des références, téléchargement
  presets.js          moteurs, formats, styles, exemples
  ui.jsx              briques d'interface
```
