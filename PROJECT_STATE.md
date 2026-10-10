# PLOT TWIST — point de reprise

## Phase 3 — deux rapports réels, boucle de recherche, revue humaine, masquage (2026-10-10)

Base : `2230df0`. Pas de nouvelle dépendance, pas de refonte ; 3D conservée et enrichie.

**Rapports réels.** `data/reports/ev-market.md` et `data/reports/work-from-home.md` (exports Ezio intacts, ignorés par Git). `GET /api/samples` et les boutons « Load real export » remplissent rapport et usage déclaré ; aucun verdict n’est stocké. Règles d’analyse génériques ajoutées : « Not scored » = non évalué ; score ≠ probabilité ; titre validé ≠ corps validé ; affirmations non listées = UNASSESSED ; verdict auto-contradictoire conservé, DISPUTED + question HUMAN.

**Parcours réels vérifiés via TokenRouter (`openai/gpt-6.1-sol`) :**
- EV : ESCALATE / risque HIGH ; Geely DISPUTED + HUMAN (entité, année, périmètre) ; Top 3 UNVERIFIABLE ; Tesla, ventes mondiales, titre SUPPORTED ; 6–7 chiffres UNASSESSED ; FINALIZE NEEDS_HUMAN. Export : « QUESTION FOR HUMAN REVIEW — NOT FINAL ».
- Télétravail : REWRITE / LOW ; BIAS CONCERN ; 4 affirmations UNVERIFIABLE, 1 SUPPORTED, thèses centrales UNASSESSED ; FINALIZE NEEDS_HUMAN. Après revue « Communication lead / ACCEPT_QUALIFIED » : FINALIZE passe à SUSPENDED (preuves manquantes toujours manquantes). Export : « DRAFT WITH RESERVATIONS — NOT FINAL ».
- Les verdicts sont produits par le modèle et peuvent varier légèrement d’une analyse à l’autre.

**Boucle Keenable réelle** (search → fetch ≤ 2 → citation → évaluation TokenRouter → permis), testée sur les deux rapports. Le serveur vérifie la présence de la citation dans la page, les drapeaux entité/période/périmètre du modèle et, de façon déterministe, la présence de l’année attendue près de la citation. Défaut réel trouvé puis corrigé : (1) une méta-phrase (« the report could not verify ») dans le texte d’une affirmation provoquait une fausse contradiction ; (2) une source « through August 2026 » était jugée contradictoire avec un classement 2024. Les anciens runs restent dans les missions concernées (journal d’audit) et y maintiennent l’escalade : utiliser de nouvelles missions pour la démo.

**Revue humaine** (`POST .../human`), **masquage/reset** d’expérience (`mask`, `reset`), **3D** (arches étiquetées, cristaux de preuve cliquables avec raisons et actions dépendantes, Scout arrêté au premier permis non ACTIVE, Passerelle et étiquette pilotées par l’état serveur, expérience en magenta, arêtes cyan). Détails : README, docs/PERMIT_POLICY.md, docs/DEMO.md.

**Vérifications.** 8 tests (synthétiques) dont revue humaine/masquage ; build OK (avertissement de taille du bundle Three.js conservé). Contrôles réels : expérience → 403, masque → suspension sélective (EV : a2 reste ACTIVE quand e1 est masqué), reset, note modifiée → NEEDS_HUMAN, aucune finalisation ouverte sur les deux rapports.

**Limites.** Pas de validation visuelle automatisée de la 3D ; pas de détail progressif fin selon le zoom (étiquettes de preuve mises à l’échelle par la distance seulement). Évaluation de sources dépendante du modèle, bornée par les contrôles serveur. Une source SUPPORTS reste candidate : aucune promotion automatique en preuve.

---

## Historique — phases précédentes

## Mise à jour — connexion sponsor et collecte Keenable

- `.env` contient désormais la clé sous le nom attendu, l’URL sponsor `https://api.tokenrouter.com/v1` et le modèle `openai/gpt-6.1-sol`. Clé jamais affichée ; `.env` reste ignoré et non suivi.
- Serveur et script de contrôle utilisent `server/config.ts`. Santé du serveur : `analysis: configured`.
- Blocage réel corrigé : le modèle refusait `max_tokens` (HTTP 400) et exige `max_completion_tokens`. Un appel minimal réel a ensuite réussi, JSON `{ "ok": true }` validé, limite de sortie 256 tokens. Pas de recharge ni de fallback modèle.
- Aucun rapport Ezio présent. Déposer le PDF original dans `/Users/vincentgppm/Projects/plot-twist/data/reports/`, ignoré par Git. Extraction PDF à effectuer à réception ; import navigateur actuellement texte uniquement.
- `server/keenable.ts` : recherche puis fetch réels, mode public sans clé Keenable, timeouts 30 s par appel, 5 résultats retenus, 1 page récupérée, contenu borné et marqué UNVERIFIED. Smoke check réel réussi : 5 résultats et page `https://docs.keenable.ai/api-reference` récupérée (2 865 caractères).
- `POST .../research` et panneau existant : requête explicite sous permis RESEARCH ACTIVE, événements persistés, sources consultables et exportables. Pas de promotion automatique en preuve factuelle, pas de résolution implicite des problèmes et aucun changement de politique de finalisation. La 3D est inchangée.
- Vérification TypeScript ciblée effectuée. Pas de répétition des tests généraux ni du build complet. Les contrôles réels de transport ne constituent pas une analyse Ezio ni une validation des quatre rapports.
- Prochaine étape : recevoir le vrai rapport et son usage, extraire/importer puis analyser ; ensuite relier l’examen des sources récupérées à une résolution explicite et traçable des problèmes. Les sections phase 2 ci-dessous décrivent le précédent jalon ; cette mise à jour remplace leur ancien constat d’accès manquants.

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
