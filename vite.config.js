import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  // Chemins relatifs pour que le build fonctionne aussi bien à la racine
  // d'un domaine que sous /bazin-erp/ sur GitHub Pages.
  base: "./",
  plugins: [react(), tailwindcss()],
});
