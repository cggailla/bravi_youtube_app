# /primer

## Objectif
Amorcer le contexte en <3000 tokens, prêt pour générer/brancher une feature sans surcharge.

## Étapes
1. Lire `claw.md`, `ai-rules.md`, `ai-context.md`.
2. Lire `prisma/schema.prisma` et extraire uniquement:
   - modèles User, Video, TranscriptSegment, EmbeddingChunk, ChatSession, Message
   - relations critiques et champs status/failureReason
3. Résumer en 8–12 points l’architecture et les flux requis par `ai-context.md`.
4. Charger les caches existants dans `.claw/cache/*.cache.md` pour:
   - prisma, supabase
5. Ne pas fetcher le web tant qu’une feature ne l’exige pas.
6. Rendre un court état prêt-à-coder:
   - fichiers clés à modifier
   - patterns imposés par `ai-rules.md`
   - question finale: “Nom de la feature à implémenter ?”
