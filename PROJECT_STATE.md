# PLOT TWIST — point de reprise

## Vision

La Trame est un univers 3D dans lequel Scout traite un vrai rapport Ezio selon l’usage déclaré. Les actions doivent recevoir un permis serveur ACTIVE / SUSPENDED / BLOCKED / NEEDS_HUMAN. La perte d’une preuve devra réévaluer seulement les actions dépendantes. La Passerelle contrôle la finalisation côté serveur. Les expériences sont isolées et ne pourront jamais finaliser, seulement exporter leur rapport d’expérience.

## Phase réalisée : 1 — socle local

React + TypeScript + Vite, API HTTP Node sans framework, Three.js / React Three Fiber / Drei, stockage JSON local. Interface anglaise avec import par collage ou fichier, usage déclaré, création et récupération d’une mission, consultation du rapport original et des événements. Scène 3D navigable, Scout en attente et Passerelle fermée. Aucun appel IA, aucune preuve ou autorisation inventée.

Les expériences sont créées exclusivement à partir d’une mission réelle et conservées dans un fichier séparé. Le masquage et l’export ne sont pas encore développés. Le serveur refuse et journalise toute finalisation, même si le client transmet un mode ou permis falsifié. Les refus concurrents sont sérialisés par mission dans le processus Node. Écriture atomique des fichiers.

## Structure

- `src/` : interface, scène 3D et styles.
- `shared/types.ts` : Mission, Claim, Evidence, Action, Permit, Event ; contrats internes, pas un schéma Ezio officiel.
- `server/` : API, validation, stockage, contrat de la Passerelle.
- `scripts/dev.mjs` : lancement conjoint Vite + Node.
- `test/server.test.ts` : tests API avec texte explicitement synthétique, supprimé avec le dossier temporaire.
- `data/` : données locales ignorées par Git.
- `.env.example` : quatre variables sponsor vides ; aucun secret côté client.

## Commandes

Node 22.12+ ; `npm install`, puis `npm run dev`.
Interface : http://127.0.0.1:5173 ; API : http://127.0.0.1:3001/api/health.
`npm test` : tests API. `npm run build` : contrôle TypeScript + build client et serveur.
`npm start` : API compilée uniquement. Ctrl+C arrête le développement.

Les routes sont documentées dans README.md. Recharger une URL `?mission=<id>` récupère la mission stockée. L’application est locale, mono-processus, sans authentification. Aucune intégration fournisseur n’est chargée dans cette phase.

## Accès et éléments manquants

- Les quatre vrais rapports exemples Ezio, leur format et les sources/preuves associées.
- Clé TokenRouter, URL de base et modèle exacts fournis par le sponsor.
- Clé Keenable et documentation d’intégration nécessaire.
- Aucun paramètre sponsor deviné. Aucun achat, déploiement, HarnessRouter ou service externe ajouté.

## Prochaine phase (ne pas démarrer automatiquement)

Adapter les quatre rapports réels sans altérer les originaux ; analyser selon l’usage (exactitude, biais, vérification des affirmations et citations) ; établir les liens preuves/actions ; implémenter et tester le moteur de permis et la propagation ciblée ; connecter la scène et le panneau aux mêmes événements serveur. Développer ensuite le masquage isolé, les exports utiles et la finalisation autorisée des seules missions réelles.

## Vérifications de livraison

- `npm test` : réussi (validation, conservation exacte du texte sur disque, récupération, isolation, refus serveur des expériences et missions réelles, journalisation concurrente).
- `npm run build` : réussi. Avertissement Vite sur le bundle Three.js supérieur à 500 kB ; optimisation différée.
- `npm run dev` : démarrage réussi ; santé vérifiée via le proxy Vite.
- Chrome headless : scène 3D visible à 1512 × 1000 après correction de son dimensionnement ; pas de test automatisé des interactions souris.
- Secrets et dossiers d’exécution exclus de Git. Aucun vrai rapport ni clé disponible pendant cette phase.
- Les restrictions du bac à sable ont nécessité une autorisation pour installer les dépendances, ouvrir les sockets locaux et lancer Chrome.

Phase 1 terminée. Reprendre uniquement sur instruction de l’utilisateur.
