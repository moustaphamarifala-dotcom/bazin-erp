import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { createHash } from "node:crypto";
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";

/* Après le build, remplit dist/sw.js avec la liste exacte des fichiers de
   l'application : le service worker peut alors tout garder dès la première
   visite, et l'application s'ouvre ensuite sans connexion. */
function serviceWorkerBazin() {
  let dossier = "dist";
  const lister = (dir) =>
    readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
      e.isDirectory() ? lister(join(dir, e.name)) : [join(dir, e.name)]
    );
  return {
    name: "service-worker-bazin",
    apply: "build",
    configResolved(config) { dossier = config.build.outDir; },
    closeBundle() {
      const fichiers = lister(dossier)
        .map((f) => relative(dossier, f).split("\\").join("/"))
        .filter((f) => f !== "sw.js")
        .sort();
      const empreinte = createHash("sha256");
      fichiers.forEach((f) => empreinte.update(f).update(readFileSync(join(dossier, f))));
      const liste = ["./", ...fichiers.map((f) => "./" + f)];
      const sw = readFileSync(join(dossier, "sw.js"), "utf8")
        .replace('const VERSION = "__VERSION__";', `const VERSION = ${JSON.stringify(empreinte.digest("hex").slice(0, 12))};`)
        .replace("const FICHIERS = __FICHIERS__;", `const FICHIERS = ${JSON.stringify(liste)};`);
      if (sw.includes("= __FICHIERS__") || sw.includes('= "__VERSION__"')) {
        throw new Error("sw.js : la liste des fichiers n'a pas été remplie");
      }
      writeFileSync(join(dossier, "sw.js"), sw);
    },
  };
}

export default defineConfig({
  // Chemins relatifs pour que le build fonctionne aussi bien à la racine
  // d'un domaine que sous /bazin-erp/ sur GitHub Pages.
  base: "./",
  plugins: [react(), tailwindcss(), serviceWorkerBazin()],
  // Deux pages : l'application complète et l'espace teinture à part
  build: { rollupOptions: { input: { main: "index.html", teinture: "teinture.html" } } },
});
