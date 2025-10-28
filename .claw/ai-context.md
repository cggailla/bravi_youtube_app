# Contexte IA — bravi-youtube-app

## Mission
Application RAG pour vidéos YouTube. L’utilisateur ajoute des URLs YouTube ou des chaînes. Ingestion en arrière-plan via Inngest. L’utilisateur scope le chat à un sous-ensemble de vidéos. Le modèle répond uniquement à partir des segments pertinents et cite ses sources avec timestamps.

## Layout
- Colonne gauche: Historique de conversations, profil utilisateur.
- Colonne centrale: Chat.
- Colonne droite: Explorateur KB, liste des vidéos, ajout vidéo/chaîne.

## Flux d’ingestion (asynchrone)
1) UI → Server Action `addVideo(url)`
   - Crée `Video` en DB avec `status: 'QUEUED'`.
   - `inngest.send('youtube/video.ingest', { videoId })`.
2) Fonction Inngest `youtube/video.ingest`
   - Récupère métadonnées YouTube.
   - Transcrit audio en segments.
   - Découpe en chunks, crée embeddings.
   - Upsert dans ZeroEntropy avec metadata `{ videoId, channelId, start, end }`.
   - Met `Video.status = 'READY'` ou `FAILED` avec message.

## Flux de chat (RAG)
1) UI → Server Action `askQuestion({ sessionId, question, scopeVideoIds })`.
2) Backend
   - Embedding question.
   - Query ZeroEntropy avec filtre `videoId in scopeVideoIds`.
   - Sélectionne N chunks les plus pertinents.
   - Construit prompt avec contexte + citations [videoTitle @ 03:12–03:40].
   - Streame la réponse via Vercel AI SDK.

## Modèles Prisma proposés
- `User` synchronisé via Supabase `auth.users` par `userId`.
- `Video` { id, userId, url, title, channelId, status, failureReason, createdAt }
- `TranscriptSegment` { id, videoId, startSec, endSec, text }
- `EmbeddingChunk` { id, videoId, segmentId?, chunkIndex, vectorRef, startSec, endSec }
- `ChatSession` { id, userId, title, createdAt, updatedAt }
- `Message` { id, sessionId, role, content, createdAt }

Note. `vectorRef` pointe l’identifiant ZeroEntropy. Les embeddings ne sont pas stockés en clair dans Postgres.

## Événements Inngest
- `youtube/video.ingest`
- `youtube/channel.refresh` (optionnel)
- `rag/embedding.backfill` (optionnel)

## Dossiers suggérés
Regarder comment est construit le projet. Et respecter l'architecture du projet pour créer de nouvelles fonctionnalités. 
- `app/protected/kb` Explorateur KB
- `app/protected/chat` Chat
- `app/auth` Auth
- `lib/inngest/route.ts` Endpoint Inngest
- `lib/supabase/server.ts` Client SSR
- `prisma/schema.prisma` Modèle
- `lib/zeroentropy/zeroentropy.ts` Client ZeroEntropy
...

## Bibliothèques installées
- `@supabase/ssr`, `@supabase/supabase-js`
- `@prisma/client`, `prisma`
- `inngest`, `@inngest/next`
- `tailwindcss`, `clsx`, `shadcn/ui`

Tu dois générer du code conforme à ce contexte.