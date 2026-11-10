import "./storage.js";
import React from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import BazinApp from "./BazinApp.jsx";

// Le navigateur propose l'installation avant que la page Sauvegarde soit ouverte :
// on garde la proposition pour le bouton « Installer l'application ».
window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  window.__bazinInstall = e;
  window.dispatchEvent(new Event("bazin-install-pret"));
});

// Service worker : l'application s'ouvre même sans connexion (build en ligne uniquement)
if (import.meta.env.PROD && "serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch(() => {});
  });
}

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BazinApp />
  </React.StrictMode>
);
