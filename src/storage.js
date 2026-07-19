/* Adaptateur de stockage : BazinApp attend window.storage (API clé/valeur
   asynchrone). Ici, les données sont persistées dans le localStorage du
   navigateur. */
if (!window.storage) {
  window.storage = {
    async get(key) {
      const value = localStorage.getItem(key);
      return value === null ? null : { key, value };
    },
    async set(key, value) {
      localStorage.setItem(key, value);
      return { key, value };
    },
    async delete(key) {
      localStorage.removeItem(key);
      return { key };
    },
  };
}
