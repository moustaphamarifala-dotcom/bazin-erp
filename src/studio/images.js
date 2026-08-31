/* Utilitaires image : conversion, réduction des références, téléchargement. */

/* Les références sont réduites avant l'envoi : une photo de téléphone pèse
   plusieurs Mo et fait grossir inutilement la requête. */
const COTE_MAX_REFERENCE = 1536;
const TYPES_ACCEPTES = ["image/png", "image/jpeg", "image/webp"];

export const estImageAcceptee = (file) => TYPES_ACCEPTES.includes(file?.type);

export function lireFichier(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error || new Error("Lecture du fichier impossible"));
    reader.readAsDataURL(file);
  });
}

function chargerImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Fichier image illisible"));
    img.src = src;
  });
}

/** Fichier → { mimeType, data (base64 sans en-tête), apercu (data URL) }. */
export async function fichierVersReference(file) {
  const dataUrl = await lireFichier(file);
  const img = await chargerImage(dataUrl);
  const cote = Math.max(img.width, img.height);

  if (cote <= COTE_MAX_REFERENCE && file.type !== "image/webp") {
    return { mimeType: file.type, data: dataUrl.split(",")[1], apercu: dataUrl };
  }

  const echelle = Math.min(1, COTE_MAX_REFERENCE / cote);
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(img.width * echelle);
  canvas.height = Math.round(img.height * echelle);
  const ctx = canvas.getContext("2d");
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  const reduit = canvas.toDataURL("image/jpeg", 0.92);
  return { mimeType: "image/jpeg", data: reduit.split(",")[1], apercu: reduit };
}

export function base64VersBlob(base64, mimeType) {
  const binaire = atob(base64);
  const octets = new Uint8Array(binaire.length);
  for (let i = 0; i < binaire.length; i += 1) octets[i] = binaire.charCodeAt(i);
  return new Blob([octets], { type: mimeType });
}

export function blobVersBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1]);
    reader.onerror = () => reject(reader.error || new Error("Lecture du blob impossible"));
    reader.readAsDataURL(blob);
  });
}

const extension = (mimeType) => (mimeType === "image/jpeg" ? "jpg" : mimeType === "image/webp" ? "webp" : "png");

function slug(texte) {
  return (
    String(texte || "image")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "image"
  );
}

export function telechargerBlob(blob, prompt, mimeType) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${slug(prompt)}-${Date.now().toString(36)}.${extension(mimeType)}`;
  a.click();
  /* La révocation immédiate annule parfois le téléchargement sous Safari. */
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

/** Copie l'image dans le presse-papiers (PNG uniquement selon les navigateurs). */
export async function copierImage(blob) {
  if (!navigator.clipboard?.write || typeof ClipboardItem === "undefined") {
    throw new Error("Votre navigateur ne permet pas de copier une image.");
  }
  const png =
    blob.type === "image/png" ? blob : await reencoderEnPng(blob);
  await navigator.clipboard.write([new ClipboardItem({ "image/png": png })]);
}

async function reencoderEnPng(blob) {
  const url = URL.createObjectURL(blob);
  try {
    const img = await chargerImage(url);
    const canvas = document.createElement("canvas");
    canvas.width = img.width;
    canvas.height = img.height;
    canvas.getContext("2d").drawImage(img, 0, 0);
    return await new Promise((resolve, reject) =>
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Conversion PNG impossible"))), "image/png")
    );
  } finally {
    URL.revokeObjectURL(url);
  }
}
