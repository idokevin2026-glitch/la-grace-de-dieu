/**
 * Higgsfield — Seedance 2.5 (text-to-video) via le SDK officiel @higgsfield/client.
 *
 * Réfs : https://docs.higgsfield.ai/docs/how-to/sdk
 *        https://console.higgsfield.ai/models/bytedance/seedance-2.5/text-to-video/api-reference
 *
 * Les identifiants sont lus par le SDK depuis la variable d'environnement
 * HF_CREDENTIALS (format "KEY_ID:KEY_SECRET"), jamais codés en dur. On la charge
 * depuis .env.local (ignoré par Git). Lancer avec : `npm run hf:seedance`.
 */
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });

import { higgsfield } from "@higgsfield/client/v2";

async function main(): Promise<void> {
  // Le SDK lit HF_CREDENTIALS (ou HF_KEY) dans l'environnement. On vérifie juste
  // sa présence — sans jamais afficher ni logguer sa valeur.
  if (!process.env.HF_CREDENTIALS && !process.env.HF_KEY) {
    throw new Error(
      "HF_CREDENTIALS manquant. Ajoute-le dans .env.local au format KEY_ID:KEY_SECRET.",
    );
  }

  // subscribe() attend la fin (withPolling = true par défaut) et renvoie le
  // statut final : "completed" | "failed" | "nsfw" (modéré).
  const result = await higgsfield.subscribe(
    "bytedance/seedance-2.5/text-to-video",
    {
      input: {
        prompt: "A cinematic scene at sunset",
        duration: 5,
        resolution: "720p",
        aspect_ratio: "16:9",
      },
    },
  );

  // On ne déclare un succès QUE si la génération est bien terminée avec une URL.
  // failed / nsfw (modéré) / canceled / tout statut inattendu → erreur explicite.
  if (result.status !== "completed" || !result.video?.url) {
    throw new Error(
      `Génération non aboutie — statut « ${result.status} » ` +
        `(request_id: ${result.request_id}). ` +
        `Traiter comme échec (ni succès, ni URL exploitable).`,
    );
  }

  console.log("✅ Vidéo générée avec succès :");
  console.log(result.video.url);
}

main().catch((err: unknown) => {
  console.error("❌ Échec de la génération :", err instanceof Error ? err.message : err);
  process.exit(1);
});
