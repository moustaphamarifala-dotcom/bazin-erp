# Bazin ERP

Application de gestion Bazin — registre de gestion pour une petite entreprise :
clients, fournisseurs, stock, factures et devis.

## Fonctionnalités

- **Tableau de bord** : statistiques, chiffre d'affaires encaissé sur 6 mois,
  factures en retard avec relance par email, alertes de stock bas.
- **Clients & fournisseurs** : fiches complètes, recherche, export CSV.
- **Stock** : quantités, prix unitaires, seuils d'alerte, lien fournisseur.
- **Factures & devis** : numérotation automatique, lignes reprises depuis le
  stock, statuts (en attente / envoyé / payé), impression au format A4 (PDF via
  la boîte de dialogue d'impression du navigateur).

Les données sont enregistrées localement dans le navigateur (localStorage) —
aucun serveur n'est requis.

## Démarrage

```bash
npm install
npm run dev       # serveur de développement
npm run build     # build de production dans dist/
npm run preview   # prévisualiser le build
```

## Pile technique

- [React 18](https://react.dev/) + [Vite](https://vite.dev/)
- [Tailwind CSS 4](https://tailwindcss.com/)
- [Recharts](https://recharts.org/) pour le graphique du tableau de bord
