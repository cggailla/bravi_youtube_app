import { YoutubeTranscript } from "youtube-transcript-plus";

// === Configuration ===
const url = "_bEl6413bA8"; // ID ou URL YouTube
const LANGS = ["en", "en-US", "fr", "fr-FR", "es"];
const MAX_CHARS_PER_CHUNK = 3000;
const API_KEY = "ze_97gJRy3H4jpc9axS";

// === Utilitaire pour nettoyage du texte ===
function cleanText(text) {
  return text
    .replace(/&amp;#39;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

// === Conversion brute -> segments ===
function toSegments(rawTranscript) {
  return rawTranscript.map((seg, i) => ({
    index: i,
    text: cleanText(seg.text),
    startSec: Number(seg.offset.toFixed(3)),
    endSec: Number((seg.offset + seg.duration).toFixed(3)),
    lang: seg.lang,
  }));
}

// === Chunking amélioré avec métadonnées temporelles ===
function chunkSegments(segments, maxChars = MAX_CHARS_PER_CHUNK) {
  const chunks = [];
  let currentText = "";
  let startSec = segments[0]?.startSec ?? 0;
  let chunkStartIndex = 0;

  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    const newText = (currentText + " " + seg.text).trim();

    // Si le texte devient trop long, on ferme le chunk actuel
    if (newText.length > maxChars && currentText.length > 0) {
      const endSec = segments[i - 1].endSec;
      chunks.push({
        index: chunks.length,
        text: currentText.trim(),
        startSec,
        endSec,
        segmentRange: [chunkStartIndex, i - 1],
      });

      console.log(
        `🧩 Nouveau chunk créé (#${chunks.length - 1}) → ${startSec.toFixed(2)}s → ${endSec.toFixed(2)}s`
      );

      // On démarre un nouveau chunk
      currentText = seg.text;
      startSec = seg.startSec;
      chunkStartIndex = i;
    } else {
      currentText = newText;
    }
  }

  // Dernier chunk
  if (currentText.length > 0) {
    const endSec = segments.at(-1).endSec;
    chunks.push({
      index: chunks.length,
      text: currentText.trim(),
      startSec,
      endSec,
      segmentRange: [chunkStartIndex, segments.length - 1],
    });
    console.log(
      `🧩 Dernier chunk (#${chunks.length - 1}) → ${startSec.toFixed(2)}s → ${endSec.toFixed(2)}s`
    );
  }

  console.log(`\n✅ Chunking terminé : ${chunks.length} chunks générés.\n`);
  return chunks;
}


// === Vérification ou Création automatique de la collection en fonction du userId ===
async function ensureZeroEntropyCollection(userId) {
  const API_URL = "https://api.zeroentropy.dev/v1/collections/add-collection";
  const collectionName = `user_${userId}_videos`;

  console.log(`\n🔍 Vérification/Création de la collection "${collectionName}"...`);

  const res = await fetch(API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      "collection_name": collectionName,
    }),
  });

  if (res.ok) {
    console.log(`✅ Collection "${collectionName}" créée ou déjà existante.`);
  } else {
    const txt = await res.text();
    if (txt.includes("already exists")) {
      console.log(`ℹ️  Collection "${collectionName}" déjà existante.`);
    } else {
      console.error("❌ Erreur lors de la création de la collection :", txt);
      throw new Error("Impossible de créer la collection ZeroEntropy.");
    }
  }
}

// === Envoi à ZeroEntropy ===
async function uploadChunksToZeroEntropy(chunks, videoId, userId = "test_user") {
  const API_URL = "https://api.zeroentropy.dev/v1/documents/add-document";

  if (!API_KEY) {
    throw new Error("❌ ZEROENTROPY_API_KEY manquant dans les variables d'environnement.");
  }

  console.log(`\n🚀 Début de l’upload vers ZeroEntropy (${chunks.length} documents)...\n`);

  let success = 0;
  let failed = 0;

  for (const chunk of chunks) {
    const body = {
      collection_name: `user_${userId}_videos`,
      path: `video_${videoId}_chunk_${chunk.index}.txt`,
      content: { type: "text", text: chunk.text },
        metadata: {
        videoId: String(videoId),
        startSec: chunk.startSec.toFixed(3),
        endSec: chunk.endSec.toFixed(3),
  },
      overwrite: false,
    };

    try {
      const res = await fetch(API_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        console.log(
          `✅ Chunk #${chunk.index} ajouté [${chunk.startSec.toFixed(2)}s → ${chunk.endSec.toFixed(2)}s]`
        );
        success++;
      } else {
        const errText = await res.text();
        console.error(`❌ Erreur upload chunk #${chunk.index} →`, errText);
        failed++;
      }
    } catch (err) {
      console.error(`❌ Exception upload chunk #${chunk.index}:`, err.message);
      failed++;
    }
  }

  console.log(`\n📊 Résumé upload ZeroEntropy : ${success} réussis, ${failed} échoués\n`);
}

async function waitForIndexing(collectionName) {
  const API_URL = "https://api.zeroentropy.dev/v1/status/get-status";

  console.log(`\n⏳ Attente de l'indexation complète pour "${collectionName}"...`);

  while (true) {
    const res = await fetch(API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ collection_name: collectionName }),
    });

    if (!res.ok) {
      const txt = await res.text();
      throw new Error(`Erreur ZeroEntropy /status → ${res.status}: ${txt}`);
    }

    const data = await res.json();
    const {
      num_documents,
      num_parsing_documents,
      num_indexing_documents,
      num_indexed_documents,
      num_failed_documents,
    } = data;

    console.log(
      `📊 Status → total: ${num_documents} | parsing: ${num_parsing_documents} | indexing: ${num_indexing_documents} | indexed: ${num_indexed_documents} | failed: ${num_failed_documents}`
    );

    // Vérifie si tout est indexé
    if (
      num_documents > 0 &&
      num_indexed_documents === num_documents &&
      num_failed_documents === 0
    ) {
      console.log(`✅ Tous les ${num_documents} documents sont indexés pour "${collectionName}".`);
      return data; // on renvoie le statut final
    }

    // Si pas encore complet, on attend 4 secondes
    await new Promise((r) => setTimeout(r, 4000));
  }
}




// === Pipeline principal ===
async function main() {
  console.log("🚀 Démarrage du pipeline YouTube Transcript + Chunking\n");
  console.log(`🎯 Vidéo ciblée : ${url}\n`);

    let ingestionSuccess = false;

    for (const lang of LANGS) {
    try {
        console.log(`🌍 Tentative de récupération des sous-titres [lang=${lang}]...`);
        const transcript = await YoutubeTranscript.fetchTranscript(url, {
        lang,
        });

        // Si on trouve une transcript valide
        if (transcript && transcript.length > 0) {
        console.log(`✅ ${transcript.length} segments trouvés pour la langue "${lang}"\n`);

        // === Ingestion complète ===
        try {
            console.log("🧹 Nettoyage + structuration...");
            const segments = toSegments(transcript);
            const chunks = chunkSegments(segments);
            await ensureZeroEntropyCollection("demo_user");
            await uploadChunksToZeroEntropy(chunks, url, "demo_user");

            // === Vérification d’indexation ===
            const stats = await waitForIndexing(`user_demo_user_videos`);
            console.log("\n✅ Ingestion réussie !");
            console.log("📊 Statistiques d’indexation :", stats);
            ingestionSuccess = true;
            break; // on arrête totalement la boucle ici
        } catch (ingestErr) {
            console.error(`💥 Échec ingestion pour "${lang}" →`, ingestErr.message);
            throw ingestErr; // on sort, on ne tente PAS les autres langues
        }
        } else {
        console.log(`⚠️ Aucun segment trouvé pour "${lang}"`);
        }
    } catch (err) {
        console.error(`❌ Erreur pour "${lang}":`, err.message);
    }
    }

    if (!ingestionSuccess) {
    throw new Error("❌ Aucun transcript disponible ou ingestion échouée pour toutes les langues.");
    }
}

// === Lancement ===
main().catch((err) => {
  console.error("\n💥 Échec du pipeline :", err.message);
});
