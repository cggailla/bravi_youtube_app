# Bravi — YouTube Knowledge Base

Bravi est une application qui indexe et rend consultable du contenu YouTube (métadonnées, transcriptions, embeddings) et fournit une interface réactive avec mises à jour en temps réel via Supabase.

Ce README vise un utilisateur souhaitant installer l'app en local et comprendre rapidement ses choix techniques.

---

## 1) Screenshots & GIFs

Voici les layouts des deux pages majeurs de l'app : login

```md
![Login page](docs/screenshots/login-page.png)
```

et la page principale où se retrouve tout les services
```md
![Home page](docs/screenshots/home_page.png)
```

---

## 2) Setup (installer et lancer en local)

Prérequis
- Node.js LTS (18+ recommandé)
- npm
- Postgres (local ou distant)

Étapes (PowerShell)

```powershell
git clone https://github.com/cggailla/bravi_youtube_app.git
cd bravi_youtube_app
npm install

# Créez .env.local (voir exemple ci-dessous)
npx prisma generate
npx prisma migrate dev --name init
npm run dev
```

Exemple minimal `.env.local` (NE PAS COMMIT)

```
DATABASE_URL="postgresql://user:pass@localhost:5432/bravi"
NEXT_PUBLIC_SUPABASE_URL="https://<project-ref>.supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="<anon-key>"
SUPABASE_SERVICE_ROLE_KEY="<service-role-key>" # serveur seulement
```

Ouvrir http://localhost:3000

Build production

```powershell
npm run build
npm start
```

---

## 3) Architecture (schéma)

ASCII diagramme simple :

```
                           +----------------+
                           |   Utilisateur  |
                                   |
                                   v
                             Next.js (UI)
                           /      |       \
                          v       v        v
                Supabase Realtime  API   Server Actions
                     |               |        |
                     v               v        v
                 Postgres <--- Prisma Client <-- Inngest Workers
```

- Frontend : composants React (mix `use client` / server components)
- Supabase : Realtime pour `postgres_changes` sur la table `videos`
- Prisma : modèle et client pour Postgres
- Inngest : pipelines asynchrones pour ingestion/processing
- Youtube-transcript-plus : récupère les caption autogénérés des vidéos youtube
- Zeroentropy : Embedding, Vector Store, Indexer pour la KB

---

## 4) Design decisions & trade-offs

- Realtime via Supabase Postgres Changes
  - Avantage : faible latence, RLS respectée, facile à intégrer côté client
  - Trade-off : payloads peuvent être partiels — on choisit de fetcher la row complète côté client pour garantir la cohérence

- Prisma + Postgres
  - Avantage : modèle de données typé, migrations contrôlées
  - Trade-off : nécessité d'une migration et d'une base en dev, plus lourd qu'un stockage NoSQL simple

- Inngest pour ingestion
  - Avantage : workflows robustes, réessayable, visibilité sur les étapes
  - Trade-off : complexité opérationnelle supplémentaire (monitoring, triggers)

- Next.js App Router + Server Actions
  - Avantage : séparation nette server/client, possibilités de SSR et actions server
  - Trade-off : nécessité de bien gérer où instancier le client Supabase (server vs client) pour éviter fuites de clés

---

## 5) Retrieval / scoping approach (approche de recherche)

- Indexation
  - Lors de l'ingestion, on stocke : metadata (title, channel, thumbnail, duration), transcription découpée en segments, embeddings par segment (optionnel)

- Recherche
  - Étape 1 : filtrage scope (ex : canal, période, tags) côté DB via Prisma/Supabase
  - Étape 2 : recherche sémantique (embedding similarity) sur les segments pertinents
  - Étape 3 : récupération des segments les plus pertinents et re-ranking simple (TF-IDF ou heuristique temporelle)

- Scoping
  - UI expose filtres (channel, date, statut). Ces filtres restreignent d'abord les candidats avant d'appliquer la recherche sémantique pour réduire coût et bruit.

---

## 6) Known limitations & next steps

Limitations actuelles
- app absolument pas fonctionnelle : il manque la grande majorité des outils !!!!!!
 
L'UI/ UX est presque en place et l'interface peut être utilisé, il faut brancher les services derrières. 


## 7) Resources & fichiers clés

- `prisma/schema.prisma` — schéma DB
- `components/kb/knowledge-base-panel.tsx` — affichage vidéos + subscription realtime
- `components/chat/center-chat.tsx` — chat demo + composer
- `app/actions/ingest.ts` — server action pour ingestion
- `app/api/ingest/route.ts` — API route proxy pour soumettre URL

---
