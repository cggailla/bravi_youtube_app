# /execute PRP [feature-name]

## Objectif
Implémenter la feature telle que décrite par le PRP avec le minimum de contexte utile.

## Étapes
1. Lire `.claw/prp/[feature-name].md`.
2. À partir de la section “🔗 Ressources techniques”, charger d’abord les caches `.claw/cache/*.cache.md`.
   - Si un cache manque, créer un résumé <1000 tokens en lisant l’URL du `knowledge_registry.json`, sauvegarder en cache puis l’utiliser.
3. Générer le code collable avec chemins complets.
   - Inclure `"use server"` ou `"use client"` dans chaque fichier pertinent.
   - Respecter strictement `ai-rules.md`.
4. Si le PRP demande un branchement UI, modifier les composants listés et connecter au state ou context existant.
5. Produire un court diff virtuel:
   - chemins, exports, imports ajoutés
6. Si “Tests/Validation” est présent, générer les tests correspondants sans exécution immédiate.

## Sortie
- Blocs de code complets et typés
- Liste des fichiers créés/modifiés
- Prochaines actions éventuelles (ex: `npx prisma migrate dev`)
