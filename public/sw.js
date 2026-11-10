/* Service worker de Bazin : permet d'ouvrir l'application sans connexion.
   - Pages (index.html, teinture.html) : réseau d'abord, donc une mise à jour
     en ligne arrive toujours ; la copie gardée ne sert que hors connexion.
   - Fichiers de l'application (assets/…, au nom unique à chaque version) :
     copie gardée d'abord.
   Les données de gestion ne passent jamais par ici : elles restent dans le
   stockage du navigateur.
   __VERSION__ et __FICHIERS__ sont remplis au moment du build (vite.config.js). */
const VERSION = "__VERSION__";
const CACHE = `bazin-${VERSION}`;
const FICHIERS = __FICHIERS__;

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(FICHIERS)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((noms) => Promise.all(noms.filter((n) => n.startsWith("bazin-") && n !== CACHE).map((n) => caches.delete(n))))
      .then(() => self.clients.claim())
  );
});

const garder = (requete, reponse) => {
  if (reponse && reponse.ok && reponse.type === "basic") {
    const copie = reponse.clone();
    caches.open(CACHE).then((cache) => cache.put(requete, copie)).catch(() => {});
  }
  return reponse;
};

self.addEventListener("fetch", (event) => {
  const requete = event.request;
  if (requete.method !== "GET") return;
  const url = new URL(requete.url);
  if (url.origin !== self.location.origin) return; // polices, etc. : le navigateur s'en occupe

  if (requete.mode === "navigate") {
    event.respondWith(
      fetch(requete)
        .then((reponse) => garder(requete, reponse))
        .catch(async () => {
          const cache = await caches.open(CACHE);
          return (
            (await cache.match(requete, { ignoreSearch: true })) ||
            (await cache.match("./index.html")) ||
            Response.error()
          );
        })
    );
    return;
  }

  event.respondWith(
    caches.open(CACHE).then(async (cache) => {
      const enCache = await cache.match(requete);
      if (enCache) return enCache;
      return fetch(requete).then((reponse) => garder(requete, reponse));
    })
  );
});
