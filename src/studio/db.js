/* Galerie persistante (IndexedDB).
   Les images sont volumineuses : le localStorage (~5 Mo) est inadapté, on
   stocke donc les Blob directement dans IndexedDB. Si la base est
   indisponible (navigation privée, stockage refusé), l'application continue
   de fonctionner en mémoire seulement. */

const DB_NOM = "bazin-studio";
const DB_VERSION = 1;
const STORE = "creations";

let promesseDb = null;

function ouvrir() {
  if (promesseDb) return promesseDb;
  promesseDb = new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB indisponible"));
      return;
    }
    const req = indexedDB.open(DB_NOM, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: "id" });
        store.createIndex("creeLe", "creeLe");
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error("Ouverture d'IndexedDB refusée"));
  }).catch((err) => {
    promesseDb = null;
    throw err;
  });
  return promesseDb;
}

function transaction(mode, action) {
  return ouvrir().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction(STORE, mode);
        const req = action(tx.objectStore(STORE));
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error || new Error("Transaction annulée"));
        tx.oncomplete = () => resolve(req?.result);
      })
  );
}

/** Vrai si la galerie peut être persistée dans ce navigateur. */
export async function galerieDisponible() {
  try {
    await ouvrir();
    return true;
  } catch {
    return false;
  }
}

export function enregistrerCreation(creation) {
  return transaction("readwrite", (store) => store.put(creation));
}

/** Créations les plus récentes d'abord. */
export async function listerCreations() {
  const items = await transaction("readonly", (store) => store.getAll());
  return (items || []).sort((a, b) => (a.creeLe < b.creeLe ? 1 : -1));
}

export function supprimerCreation(id) {
  return transaction("readwrite", (store) => store.delete(id));
}

export function viderGalerie() {
  return transaction("readwrite", (store) => store.clear());
}
