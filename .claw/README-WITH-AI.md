# Développer avec l’IA — bravi-youtube-app

Ce guide explique comment travailler efficacement avec Codex GPT et GitHub Copilot Chat tout en respectant notre stack stricte.

## Démarrage rapide
1. Ouvre Copilot Chat.
2. Écris `@workspace /read .vscode/ai-rules.md` puis `@workspace /read .vscode/ai-context.md`.
3. Colle le prompt d’ouverture ci-dessous dans la première conversation.
4. Utilise les prompts de la bibliothèque selon le besoin.

## Prompt d’ouverture recommandé
Colle ce message au début de chaque nouvelle session IA.

> Tu es mon expert pair-programmer. Respecte strictement ces fichiers:
> - .vscode/ai-rules.md
> - .vscode/ai-context.md
> Quand une demande s’écarte de la stack, explique pourquoi et propose l’implémentation conforme. Réponds avec du code collable et des chemins de fichiers. Utilise Server Actions pour les mutations, Inngest pour les tâches longues, Prisma pour la DB, ZeroEntropy pour la recherche vectorielle, Supabase Auth via @supabase/ssr, shadcn/ui + Tailwind pour l’UI, Vercel AI SDK pour le streaming.

## Bibliothèque de prompts

### Génération UI
- **Layout 3 colonnes**
  - `@workspace Génère un layout à 3 colonnes avec ResizablePanelGroup. Colonne gauche: historique et profil. Centre: chat. Droite: KB. Utilise shadcn/ui. Chemin: app/(dashboard)/layout.tsx`
- **Section Profil server component**
  - `@workspace Crée app/(dashboard)/_components/ProfileSection.tsx en Server Component. Fetch user via createServerClient de @/lib/supabase/server. Affiche email et bouton logout (Server Action).`

### Prisma
- **Schéma minimal**
  - `@workspace Écris prisma/schema.prisma pour User, Video, TranscriptSegment, EmbeddingChunk, ChatSession, Message comme décrit dans ai-context.md. Ajoute index utiles.`
- **Requête par user**
  - `@workspace Donne la requête Prisma pour lister toutes les vidéos d’un userId triées par createdAt desc, select id, title, status.`

### Server Actions
- **Ajouter une vidéo**
  - `@workspace Crée app/(dashboard)/kb/actions.ts avec "use server". Action addVideo(url: string). Auth SSR. Insert Video { status: 'QUEUED' } via Prisma. Envoie l’événement Inngest youtube/video.ingest.`
- **Envoyer une question RAG**
  - `@workspace Crée app/(dashboard)/chat/actions.ts avec "use server". Action askQuestion({ sessionId, question, scopeVideoIds }). Embedding question, query ZeroEntropy filtré par scope, stream via Vercel AI SDK.`

### Inngest
- **Squelette ingestion**
  - `@workspace Crée inngest/functions/youtube.video.ingest.ts. Handler pour l’événement "youtube/video.ingest". Transcription, chunking, embeddings, upsert ZeroEntropy, update Video.status.`
- **Route Inngest**
  - `@workspace Crée app/api/inngest/route.ts exposant le handler Inngest via @inngest/next.`

### ZeroEntropy
- **Client**
  - `@workspace Crée lib/zeroentropy.ts. Expose searchByEmbedding(embedding: number[], scopeVideoIds: string[], topK: number) qui renvoie chunks avec metadata startSec, endSec, videoId.`

### Debug
- **cookies() SSR**
  - `@workspace Analyse erreur cookies() non accessible en client component. Déplace la logique d’auth dans un Server Component ou une Server Action. Donne patch minimal.`

## Bonnes pratiques avec Copilot Chat
- Utilise `@workspace /read` sur les fichiers de règles au début.
- Demande des sorties collables. Un fichier par bloc si possible.
- Exige les imports et les chemins.
- Si une réponse dévie, renvoie la ligne concernée du fichier ai-rules.md.
EOF

# 5) .vscode/ai-opening-prompt.txt
cat > .vscode/ai-opening-prompt.txt << 'EOF'
Tu es mon expert pair-programmer. Respecte strictement:
- Next.js App Router
- Supabase Auth via @supabase/ssr
- Prisma pour la DB
- Inngest pour tâches longues
- ZeroEntropy pour vecteurs
- Server Actions pour mutations
- Vercel AI SDK pour streaming
- shadcn/ui + Tailwind pour l’UI

Lis et suis:
- .vscode/ai-rules.md
- .vscode/ai-context.md

Quand je demande une feature, rends du code complet et collable avec chemins de fichiers, imports, "use server" ou "use client" quand nécessaire. Si la requête sort du cadre, refuse poliment et propose l’alternative conforme.
