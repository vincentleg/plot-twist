# PLOT TWIST — point de reprise

## Vision

La Trame est un univers 3D où Scout traite un vrai rapport Ezio selon l’usage déclaré. Les actions reçoivent un permis serveur ACTIVE / SUSPENDED / BLOCKED / NEEDS_HUMAN. La Passerelle contrôle la finalisation du contenu exact. Les expériences sont isolées et ne finalisent jamais.

## Phase réalisée : 2 — intégration d’analyse, politique et documents

Base : commit `74a6259` (phase 1). Interface et navigation 3D conservées. Aucune nouvelle dépendance, aucun achat ni déploiement.

Fonctions opérationnelles :

- Import, conservation intégrale du rapport et de l’heure d’import, usage déclaré, stockage local JSON atomique.
- Chargement serveur de `.env`, vérification de présence seulement, message exact « Analysis unavailable: provider not configured » si incomplet.
- Adaptateur TokenRouter Chat Completions : endpoint/modèle configurés, HTTPS, timeout 60 s, limite 6 000 tokens / 256 000 octets, sans retries automatiques ni simulation de remplacement. Protocole sponsor réel encore à confirmer.
- Validation structurée : affirmations, extraits, cinq signaux (faits, citations, biais, complaisance, incertitude), problèmes, usage, recommandation et 2–4 actions. Vérification des IDs, références, cycles et présence des extraits/sources avec normalisation Unicode/espaces.
- Politique serveur lisible, indépendante d’un simple verdict modèle. Dépendances ciblées, portée des problèmes, usage et contenu exact vérifiés. Une préparation autorisée ne signifie pas une recherche exécutée. Recherche/revue humaine encore nécessaire = aucune finalisation.
- Note de décision conservant usage, justification, éléments soutenus/nuancés, réserves, question suivante et extraits sources. Édition possible, hash SHA-256 et réévaluation ; aucune réponse humaine promue en preuve factuelle.
- `/finalize` recharge l’état courant sous verrou, refuse les expériences, réévalue FINALIZE et écrit GATEWAY_DECISION. Document final retourné uniquement pour ACTIVE ; permission liée au hash et au texte exact rendu par le serveur.
- Exports texte étiquetés : brouillon avec réserves, refus, question humaine ou expérience. Aucun export ordinaire ne se fait passer pour un document final.
- UI : analyse, progression, erreurs, recommandations, signaux, extraits consultables, permis et raisons, édition/export. Arches colorées selon les permis ; Passerelle ouverte uniquement après décision serveur favorable. Scène et panneau partagent le même état serveur.
- Récupération d’une analyse interrompue au redémarrage (FAILED, possibilité de réessayer).

Limites explicites : l’extraction, l’interprétation, l’exhaustivité des problèmes et l’évaluation des enjeux dépendent encore du modèle. Une provenance vérifiée n’est pas une vérité factuelle. Aucun enrichissement externe, masquage de preuve ou traitement Keenable. La note est un document de décision nuancé, pas une réponse réécrite dépourvue de traçabilité. Pas de synchronisation temps réel entre plusieurs clients.

## Structure

- `src/` : interface, AnalysisPanel et scène 3D.
- `shared/types.ts` : contrats internes, pas un schéma Ezio officiel.
- `server/analysis.ts` : consignes et validation des extractions.
- `server/provider.ts` : adaptateur TokenRouter et erreurs assainies.
- `server/policy.ts` : permis, contenu exact et exports.
- `server/app.ts` : API, stockage, événements, concurrence.
- `docs/PERMIT_POLICY.md` : politique et limites détaillées.
- `test/` : sept tests, fixtures et transport explicitement synthétiques.
- `data/`, `.env*` : ignorés, sauf `.env.example`.

## Commandes et parcours

Node 22.12+ ; `npm install`, puis `npm run dev`.
Interface : http://127.0.0.1:5173 ; santé : http://127.0.0.1:3001/api/health.
`npm test` ; `npm run build` ; `npm start` pour l’API compilée seule.

Renseigner `.env` puis redémarrer Node. Coller/importer un vrai rapport, préciser l’usage, Create mission → Analyze report → consulter les extraits/permis → Decision note → Finalize server note ou export non final. Le bouton de réanalyse régénère la note depuis le rapport original. L’URL `?mission=<id>` recharge l’état conservé.

## Vérifications réelles de cette phase

- Build TypeScript/Vite réussi. Avertissement de taille du bundle Three.js conservé ; pas de refonte pour le supprimer.
- Sept tests réussis : validation des extraits/références/cycles, dépendance critique manquante, action indépendante conservée, contenu édité, enjeux, incertitudes, contradictions, refus d’expérience, absence/invalidation d’analyse, Gateway autorisée uniquement dans une fixture synthétique conforme, erreurs/limites du transport mocké, absence de fournisseur.
- Serveur local préexistant réutilisé : santé OK, fournisseur explicitement non configuré. Il n’a pas été arrêté.
- Capture Chrome : scène préservée et message d’indisponibilité visibles. Pas de validation visuelle d’une analyse réelle ni de test automatisé des interactions souris.
- Aucun vrai rapport trouvé, y compris dans les données locales ignorées. Les trois variables TokenRouter sont absentes lors de la dernière vérification.
- **Aucun appel TokenRouter réel réussi ni tenté avec des identifiants inventés. Les quatre rapports n’ont pas été testés.**

## Éléments manquants et prochaine phase

Attendre les quatre vrais rapports et les paramètres TokenRouter sponsor : clé, URL de base exacte (incluant le chemin de version), modèle, confirmation des paramètres Chat Completions. Aucun endpoint ni modèle par défaut choisi.

À réception, exécuter une analyse réelle et inspecter la couverture des affirmations, les liens extraits/interprétations et les permis. Keenable, résolution par recherche, masquage isolé des preuves et réévaluation après résolution seront traités dans la phase suivante. La politique devra être confrontée aux vrais rapports, sans branches selon leur identité.

Phase 2 terminée côté implémentation ; validation fournisseur réel en attente d’accès. Ne pas démarrer automatiquement la phase suivante.
