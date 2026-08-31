/* Client minimal pour l'API Gemini (Generative Language).
   La clé n'est jamais conservée ici : elle est passée à chaque appel. */

const API_BASE = "https://generativelanguage.googleapis.com/v1beta/models";

/* Modèle texte utilisé pour réécrire/enrichir un prompt. */
export const MODELE_TEXTE = "gemini-2.5-flash";

export class GeminiError extends Error {
  constructor(message, { status, code } = {}) {
    super(message);
    this.name = "GeminiError";
    this.status = status;
    this.code = code;
  }
}

const MESSAGES_HTTP = {
  400: "Requête refusée par l'API. La clé est peut-être invalide ou le contenu non pris en charge.",
  401: "Clé API invalide.",
  403: "Accès refusé : cette clé n'a pas accès au modèle demandé.",
  404: "Modèle introuvable. Il n'est peut-être pas disponible pour votre clé.",
  429: "Quota atteint. Attendez un instant ou vérifiez la facturation du projet Google.",
  500: "Erreur interne du service Gemini. Réessayez.",
  503: "Service momentanément surchargé. Réessayez dans quelques secondes.",
};

async function appeler(model, methode, body, { apiKey, signal }) {
  if (!apiKey) {
    throw new GeminiError("Aucune clé API renseignée.", { code: "cle-absente" });
  }

  let reponse;
  try {
    reponse = await fetch(`${API_BASE}/${model}:${methode}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
      body: JSON.stringify(body),
      signal,
    });
  } catch (err) {
    if (err?.name === "AbortError") throw err;
    throw new GeminiError("Impossible de joindre l'API Gemini (problème de connexion).", {
      code: "reseau",
    });
  }

  const data = await reponse.json().catch(() => null);

  if (!reponse.ok) {
    const detail = data?.error?.message;
    throw new GeminiError(detail || MESSAGES_HTTP[reponse.status] || `Erreur HTTP ${reponse.status}.`, {
      status: reponse.status,
    });
  }
  return data;
}

/* Les réponses REST utilisent inlineData, les exemples SDK inline_data :
   on accepte les deux formes. */
function lirePartieImage(part) {
  const d = part.inlineData || part.inline_data;
  if (!d?.data) return null;
  return { mimeType: d.mimeType || d.mime_type || "image/png", data: d.data };
}

const RAISONS_BLOCAGE = {
  SAFETY: "La demande a été bloquée par les filtres de sécurité de Gemini.",
  PROHIBITED_CONTENT: "Le contenu demandé est interdit par les règles d'usage de Gemini.",
  IMAGE_SAFETY: "L'image produite a été bloquée par les filtres de sécurité.",
  BLOCKLIST: "La demande contient un terme figurant sur la liste de blocage.",
  RECITATION: "La réponse a été bloquée pour cause de récitation d'une source protégée.",
};

/**
 * Génère une ou plusieurs images.
 * `contents` suit le format Gemini : [{ role, parts: [{ text } | { inlineData }] }].
 * Retourne { images: [{ mimeType, data }], texte }.
 */
export async function genererImage({
  apiKey,
  model,
  contents,
  aspectRatio,
  imageSize,
  signal,
}) {
  const imageConfig = {};
  if (aspectRatio) imageConfig.aspectRatio = aspectRatio;
  if (imageSize) imageConfig.imageSize = imageSize;

  const data = await appeler(
    model,
    "generateContent",
    {
      contents,
      generationConfig: {
        responseModalities: ["TEXT", "IMAGE"],
        ...(Object.keys(imageConfig).length ? { imageConfig } : {}),
      },
    },
    { apiKey, signal }
  );

  const blocagePrompt = data?.promptFeedback?.blockReason;
  if (blocagePrompt) {
    throw new GeminiError(RAISONS_BLOCAGE[blocagePrompt] || `Demande bloquée (${blocagePrompt}).`, {
      code: "bloque",
    });
  }

  const candidat = data?.candidates?.[0];
  const parts = candidat?.content?.parts || [];
  const images = parts.map(lirePartieImage).filter(Boolean);
  const texte = parts
    .filter((p) => p.text)
    .map((p) => p.text)
    .join("\n")
    .trim();

  if (!images.length) {
    const raison = candidat?.finishReason;
    if (raison && RAISONS_BLOCAGE[raison]) {
      throw new GeminiError(RAISONS_BLOCAGE[raison], { code: "bloque" });
    }
    throw new GeminiError(
      texte
        ? `Le modèle a répondu sans image : « ${texte.slice(0, 300)} »`
        : "Le modèle n'a renvoyé aucune image. Reformulez la demande.",
      { code: "sans-image" }
    );
  }

  return { images, texte };
}

const CONSIGNE_ENRICHISSEMENT = `Tu es directeur artistique. Réécris la demande de l'utilisateur en un prompt de génération d'image en français, riche et précis.
Décris le sujet, la composition et le cadrage, la lumière, les matières et couleurs, l'objectif ou le medium, et l'ambiance.
Garde fidèlement l'intention et tous les éléments imposés (textes à afficher, marques, nombre de sujets).
Réponds uniquement par le prompt, en un seul paragraphe de 80 mots maximum, sans préambule ni guillemets.`;

/** Réécrit un prompt court en une description détaillée. */
export async function enrichirPrompt({ apiKey, prompt, signal }) {
  const data = await appeler(
    MODELE_TEXTE,
    "generateContent",
    {
      systemInstruction: { parts: [{ text: CONSIGNE_ENRICHISSEMENT }] },
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.9 },
    },
    { apiKey, signal }
  );

  const texte = (data?.candidates?.[0]?.content?.parts || [])
    .filter((p) => p.text)
    .map((p) => p.text)
    .join("")
    .trim();

  if (!texte) throw new GeminiError("Le modèle n'a pas su enrichir ce prompt.", { code: "vide" });
  return texte.replace(/^["«\s]+|["»\s]+$/g, "");
}
