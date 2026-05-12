# 🎬 Bravi — YouTube Knowledge Base

> Indexe du contenu YouTube (métadonnées, transcriptions, embeddings) et le rend consultable via une interface réactive temps réel.

![Stack](https://img.shields.io/badge/stack-Next.js%20·%20TypeScript%20·%20Supabase%20·%20Prisma-blue)
![Status](https://img.shields.io/badge/status-WIP%20UI%20ready-orange)

---

## Ce que ça fait

Bravi transforme une chaîne ou une liste de vidéos YouTube en **base de connaissances interrogeable** : transcriptions découpées en segments, embeddings vectoriels, recherche sémantique scopée, le tout avec des updates temps réel côté UI.

L'idée : tu donnes une URL, le pipeline ingère → transcrit → embed → indexe, et tu peux ensuite chatter avec ton corpus YouTube.

---

## Stack

- **Frontend** — Next.js (App Router) + React + TypeScript, mix server / client components
- **Realtime** — Supabase Postgres Changes (RLS-aware)
- **DB** — Postgres + Prisma (modèle typé, migrations versionnées)
- **Workers** — Inngest pour les pipelines d'ingestion async
- **Transcription** — `youtube-transcript-plus` pour récupérer les captions auto-générés
- **Vector store** — Zeroentropy (embeddings + indexer + KB)

---

## Architecture

```
                    ┌────────────────┐
                    │   Utilisateur  │
                    └────────┬───────┘
                             │
                             ▼
                       Next.js (UI)
                    ┌────────┼────────┐
                    ▼        ▼        ▼
            Supabase     API     Server Actions
            Realtime      │           │
                │         ▼           ▼
                └─→  Postgres ←── Prisma Client ←── Inngest Workers
```

---

## Setup local

Prérequis : Node 18+, npm, Postgres.

```bash
git clone https://github.com/cggailla/bravi_youtube_app.git
cd bravi_youtube_app
npm install

# Crée .env.local (voir ci-dessous)
npx prisma generate
npx prisma migrate dev --name init
npm run dev
```

`.env.local` minimal (à NE PAS commit) :

```
DATABASE_URL="postgresql://user:pass@localhost:5432/bravi"
NEXT_PUBLIC_SUPABASE_URL="https://<project-ref>.supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="<anon-key>"
SUPABASE_SERVICE_ROLE_KEY="<service-role-key>"   # server-only
```

Build prod :

```bash
npm run build
npm start
```

---

## Approche retrieval & scoping

Plutôt que de balancer toute la KB dans une recherche sémantique brute, le pipeline est en **3 étapes** pour limiter coût et bruit :

1. **Scope filter** (DB) — channel, période, tags → restreint les candidats via Prisma/Supabase
2. **Semantic search** — similarité par embedding sur les segments restants
3. **Re-ranking** — heuristique simple (TF-IDF + signal temporel) pour remonter les segments les plus pertinents

---

## Design decisions

| Choix | Pourquoi | Trade-off |
|---|---|---|
| Realtime via Supabase Postgres Changes | Faible latence, RLS gratuite | Payloads partiels → on refetch la row complète côté client |
| Prisma + Postgres | Modèle typé, migrations contrôlées | Plus lourd qu'un NoSQL pour démarrer |
| Inngest pour l'ingestion | Workflows réessayables, observables | Complexité opérationnelle (monitoring, triggers) |
| Next.js App Router + Server Actions | Séparation server/client nette | Faut bien gérer où instancier le client Supabase pour éviter de leak les service keys |

---

## État actuel

UI / UX en place et utilisable, mais **les services backend ne sont pas encore branchés**. Le squelette est là (composants, schéma DB, routes API, server actions), il reste à connecter les pipelines d'ingestion réels et le vector store.

### Next steps

- [ ] Brancher Inngest sur la pipeline complète (ingest → transcript → embed)
- [ ] Intégrer Zeroentropy côté retrieval
- [ ] Auth Supabase complète + RLS sur toutes les tables
- [ ] Tests E2E sur le flow d'ingestion

---

## Fichiers clés

- `prisma/schema.prisma` — schéma DB
- `components/kb/knowledge-base-panel.tsx` — liste vidéos + subscription realtime
- `components/chat/center-chat.tsx` — chat UI + composer
- `app/actions/ingest.ts` — server action d'ingestion
- `app/api/ingest/route.ts` — route API proxy pour soumettre une URL

---

## Author

**Côme Gaillard** — LLM Engineer @ Artefact · cofounder @ EstuIA
[LinkedIn](https://www.linkedin.com/in/comegaillard) · comegaillard@gmail.com
