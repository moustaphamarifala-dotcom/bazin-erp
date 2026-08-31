import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

const page = (nom) => fileURLToPath(new URL(nom, import.meta.url));

export default defineConfig({
  // Chemins relatifs pour que le build fonctionne aussi bien à la racine
  // d'un domaine que sous /bazin-erp/ sur GitHub Pages.
  base: "./",
  plugins: [react(), tailwindcss()],
  build: {
    // Deux pages : le registre de gestion et le studio d'images.
    rollupOptions: {
      input: { main: page("index.html"), studio: page("studio.html") },
    },
  },
});
