# CLAW — Bravi YouTube RAG App

## Mission
Quand je demande une feature, elle fonctionne directement. L’assistant doit lire le contexte projet et n’activer que les portions de connaissance nécessaires.

## Contexte minimum à charger
- `ai-context.md`  ← architecture et flux cibles
- `ai-rules.md`    ← garde-fous de stack et patterns
- `prisma/schema.prisma`
- `README.md` s’il existe

## Stack obligatoire
Next.js App Router, Supabase Auth SSR, Prisma, shadcn/ui, Tailwind, Inngest, ZeroEntropy, Vercel AI SDK, TypeScript. Respect strict de `ai-rules.md`.

## Politique de contexte/token
- Charger uniquement le contexte minimum ci-dessus.
- Connaissance outils via `knowledge_registry.json` + cache résumés `.claw/cache/*.cache.md` (<1000 tokens chacun).
- Ne télécharger une doc externe que si le PRP la mentionne. Résumer et mettre en cache.

## Exécution des features
- Définir un PRP court et actionnable.
- Générer du code collable avec chemins complets.
- Brancher au front existant si le PRP l’indique.
- Passer la validation QA auto quand demandée.

## Sécurité et qualité
- Aucune tâche longue hors Inngest.
- Aucune mutation côté client hors Server Actions.
- Aucune dépendance non autorisée.
- Types explicites. Logs clairs côté serveur seulement.

## Refus
Si une demande viole les règles, expliquer et proposer l’alternative conforme.
