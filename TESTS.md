# Documentation des tests — SwapDeck

> Projet EFREI Paris — Qualité Logicielle (M1)  
> Stack : Node.js · Express · Prisma · PostgreSQL · Jest · Playwright · k6

---

## Vue d'ensemble

SwapDeck suit une stratégie de test en **3 niveaux**, conforme au cours de Qualité logicielle EFREI :

```
┌───────────────────────────────────────────────────────────┐
│  Niveau 3 — Tests de charge (k6)                          │
│  Valide la tenue sous charge et la concurrence             │
├───────────────────────────────────────────────────────────┤
│  Niveau 2 — Tests fonctionnels E2E (Playwright)           │
│  Valide le parcours utilisateur dans le navigateur         │
├───────────────────────────────────────────────────────────┤
│  Niveau 1 — Tests unitaires (Jest)                        │
│  Valide la logique métier isolée, sans base de données     │
└───────────────────────────────────────────────────────────┘
```

### Commandes rapides

```bash
# Tests unitaires (pas de DB, 1-2s)
npm run test:unit

# Tests fonctionnels E2E (nécessite un serveur + DB)
npm run test:e2e

# Tests de charge — catalogue
k6 run tests/load/catalog.js

# Tests de charge — négociation concurrente (test d'atomicité)
k6 run tests/load/concurrent-trade.js

# Tests de charge — workflow complet
k6 run tests/load/negotiation.js
```

---

## Niveau 1 — Tests unitaires (Jest)

### Localisation
```
tests/unit/
  NegotiationCommandService.test.js   ← 32 tests (write side)
  NegotiationQueryService.test.js     ← 17 tests (read side)
```

### Principe : CQRS + Mock Prisma

L'architecture CQRS (Command Query Responsibility Segregation) sépare :
- **`NegotiationCommandService`** — toutes les mutations (créer, accepter, refuser, contre-proposer, annuler, envoyer un message)
- **`NegotiationQueryService`** — toutes les lectures (détail d'une trade, liste, historique)

Les tests unitaires **ne touchent jamais la base de données**. Prisma est entièrement remplacé par un mock `jest.fn()` qui simule les réponses attendues. Cela permet :
- Une exécution instantanée (< 1s)
- Des tests reproductibles sans dépendance externe
- Un isolement pur de la logique métier

```javascript
// Exemple de mock Prisma
const mockDb = {
  trade: { findUnique: jest.fn(), create: jest.fn(), update: jest.fn() },
  card:  { findMany: jest.fn() },
};
mockDb.$transaction = jest.fn((cb) => cb(mockDb));
jest.mock('../../backend/src/config/db', () => mockDb);
```

### Pattern AAA

Chaque test suit le pattern **Arrange → Act → Assert** :

```javascript
test('accepte si acteur est le destinataire et status PENDING', async () => {
  // ARRANGE — configurer les mocks
  mockDb.trade.findUnique.mockResolvedValue({ id: 1, status: 'PENDING', recipientId: 2 });
  mockDb.trade.update.mockResolvedValue({ ...tradeMock, status: 'ACCEPTED' });

  // ACT — appeler le service
  const result = await NegotiationCommandService.acceptTrade(1, 2);

  // ASSERT — vérifier le résultat
  expect(result.status).toBe('ACCEPTED');
  expect(mockDb.trade.update).toHaveBeenCalledTimes(1);
});
```

---

### `NegotiationCommandService.test.js` — 32 tests

#### `createTrade` (6 tests)

| Test | Cas couvert |
|------|-------------|
| crée une trade valide | Cas nominal — trade créée avec cartes offertes + demandées |
| rejette si initiateur === destinataire | Règle métier — on ne peut pas trader avec soi-même |
| rejette si aucune carte sélectionnée | Validation — au moins une carte requise |
| rejette si message absent | Validation — message obligatoire |
| rejette si cartes offertes n'appartiennent pas à l'initiateur | Sécurité — anti-usurpation de cartes |
| rejette si cartes demandées n'appartiennent pas au destinataire | Sécurité — cohérence des cartes demandées |

#### `acceptTrade` (5 tests)

| Test | Cas couvert |
|------|-------------|
| accepte si acteur est destinataire et status PENDING | Cas nominal |
| rejette si l'acteur n'est pas le destinataire | Autorisation — seul le destinataire peut accepter |
| rejette si la trade est déjà clôturée | Machine d'état — pas de double acceptation |
| lève NOT_FOUND si trade introuvable | Robustesse |
| lève INVALID_STATUS si Prisma retourne P2025 | **Race condition** — atomicité garantie par `where: { status: PENDING }` |

#### `refuseTrade` (5 tests)

Symétrique à `acceptTrade` — mêmes garanties pour le refus.

#### `counterTrade` (5 tests)

| Test | Cas couvert |
|------|-------------|
| crée une contre-proposition et marque la trade COUNTERED | Cas nominal — 2 opérations atomiques en `$transaction` |
| rejette si l'acteur n'est pas le destinataire | Autorisation |
| rejette si le message est vide | Validation |
| rejette si status pas PENDING | Machine d'état |
| lève INVALID_STATUS sur erreur P2025 dans la transaction | **Race condition dans une transaction Prisma** |

> **Note sur la transaction** : `counterTrade` effectue deux opérations BDD (update de la trade originale + création de la contre-proposition). Elles sont enveloppées dans `prisma.$transaction()` pour garantir l'atomicité : soit les deux réussissent, soit aucune.

#### `cancelTrade` (5 tests)

| Test | Cas couvert |
|------|-------------|
| annule si l'acteur est l'initiateur et status PENDING | Cas nominal — seul l'initiateur peut annuler |
| rejette si l'acteur n'est pas l'initiateur | Autorisation |
| rejette si la trade est déjà clôturée (INVALID_STATUS) | Machine d'état |
| lève NOT_FOUND si trade introuvable | Robustesse |
| lève INVALID_STATUS sur erreur P2025 | Race condition |

#### `addMessage` (6 tests)

| Test | Cas couvert |
|------|-------------|
| ajoute un message pour un participant | Cas nominal |
| rejette si body vide | Validation |
| rejette si l'auteur n'est pas participant | Sécurité |
| accepte un message sur une trade COUNTERED | Cas limite — COUNTERED est un état "ouvert" qui autorise les messages |
| rejette si la trade est clôturée (ACCEPTED) | Machine d'état — plus de messages sur trade fermée |
| rejette si la trade est clôturée (REFUSED) | Idem |

---

### `NegotiationQueryService.test.js` — 17 tests

#### `getTradeById` (4 tests)
- Retourne la trade si demandeur est initiateur ou destinataire
- Lève `UNAUTHORIZED` si demandeur non participant
- Lève `NOT_FOUND` si trade inexistante

#### `getTradesForUser` (5 tests)
- Retourne toutes les trades (envoyées + reçues) par défaut
- Filtre `role='sent'` → uniquement les trades envoyées
- Filtre `role='received'` → uniquement les trades reçues
- Pagination — `page` et `limit` respectés
- Filtre par `status`

#### `getTradeMessages` (3 tests)
- Retourne les messages pour un participant
- Lève `UNAUTHORIZED` si non participant
- Lève `NOT_FOUND` si trade inexistante

#### `getTradesByCard` (2 tests)
- Retourne les trades impliquant une carte pour son propriétaire
- Retourne un tableau vide si aucune trade concernée

#### `getNegotiationThread` (3 tests)
- Retourne la trade seule si pas de contre-propositions
- Retourne la chaîne complète (parent + contre-propositions) en ordre chronologique
- Lève `UNAUTHORIZED` si non participant

---

## Niveau 2 — Tests fonctionnels E2E (Playwright)

### Localisation
```
tests/e2e/
  catalog.spec.js        ← 11 tests — navigation catalogue
  negotiation.spec.js    ← 11 tests — cycle de négociation
  playwright.config.js   ← configuration (baseURL, navigateur)
```

### Principe

Playwright pilote un vrai navigateur Chromium et interagit avec l'interface comme un utilisateur humain. Ces tests **nécessitent un serveur Express en fonctionnement** avec une base PostgreSQL peuplée.

Le `playwright.config.js` configure un `webServer` qui démarre le serveur automatiquement avant les tests.

### Prérequis d'exécution

```bash
# 1. Base de données + serveur disponibles
#    (Docker Compose recommandé)
docker compose up -d

# 2. Lancer les tests
npm run test:e2e
```

---

### `catalog.spec.js` — 11 tests

#### Cas usuels (6 tests)

| Test | Ce qui est vérifié |
|------|--------------------|
| La page se charge et affiche des cartes après connexion | Rendu initial du catalogue |
| Les cartes ont un nom, un badge jeu et un badge rareté | Structure HTML des `card-tile` |
| Le filtre Pokémon n'affiche que des cartes Pokémon | Appel API avec `?game=POKEMON`, absence des badges `.badge-magic` / `.badge-yugioh` |
| Le filtre Magic n'affiche que des cartes Magic | Symétrique |
| Le filtre Tous recharge toutes les cartes | Réinitialisation du filtre |
| Les cartes d'autres utilisateurs ont un bouton « Proposer un échange » | Présence du `[data-propose-card]` |
| Les propres cartes affichent « Ma carte » sans bouton | Distinction `isOwn` dans le rendu |

#### Cas extrêmes (3 tests)

| Test | Ce qui est vérifié |
|------|--------------------|
| Un filtre sans résultats affiche l'état vide | Gestion des listes vides (catégorie OTHER) |
| Le placeholder graphique est affiché pour les cartes sans image réelle | Présence de `.card-image-placeholder` |
| La navigation rapide entre filtres ne plante pas | Stabilité lors de clics successifs rapides (débounce) |

#### Cas d'erreur (2 tests)

| Test | Ce qui est vérifié |
|------|--------------------|
| Redirige vers la connexion si pas de session active | Accès direct `/#catalog` sans cookie → overlay auth visible |
| Affiche un message d'erreur si l'API est indisponible | `page.route()` intercepte `/api/cards*` et retourne 500 → message d'erreur dans le DOM |

---

### `negotiation.spec.js` — 11 tests

#### Cas usuels (6 tests)

| Test | Ce qui est vérifié |
|------|--------------------|
| Axel peut proposer un échange à Mira | Ouverture du modal, sélection carte, soumission, redirection `#trade/:id` |
| Mira voit la proposition dans ses échanges reçus | Multi-sessions : Axel crée, Mira se connecte et voit dans « Reçus » |
| Mira peut accepter une proposition | Clic `#btn-accept` → badge `.badge-accepted` visible |
| Mira peut refuser une proposition | Clic `#btn-refuse` → badge `.badge-refused` visible |
| Mira peut faire une contre-proposition | Clic `#btn-counter` → formulaire `#counter-form` → nouvel ID trade créé |
| L'historique des messages est préservé | Message de proposition visible dans `.thread-messages` |

#### Cas extrêmes (2 tests)

| Test | Ce qui est vérifié |
|------|--------------------|
| Un long message (1000 caractères) est accepté et affiché | Pas de troncature silencieuse côté serveur |
| Une même trade ne peut pas être acceptée deux fois | Après acceptation, `#btn-accept` n'existe plus dans le DOM |

#### Cas d'erreur (3 tests)

| Test | Ce qui est vérifié |
|------|--------------------|
| Impossible de proposer sans sélectionner de cartes | Soumission du formulaire → `#form-error` visible, modal reste ouvert |
| Impossible de proposer sans message | Validation côté frontend |
| L'initiateur ne peut pas accepter sa propre proposition | Axel ne voit pas `#btn-accept` sur sa propre trade |

---

## Niveau 3 — Tests de charge (k6)

### Localisation
```
tests/load/
  catalog.js          ← charge sur le catalogue (GET /api/cards)
  negotiation.js      ← workflow complet de négociation sous charge
  concurrent-trade.js ← test d'atomicité — 20 VUs acceptent simultanément
```

### Principe

k6 est un outil de tests de charge qui génère des requêtes HTTP en parallèle depuis plusieurs **Virtual Users (VUs)**. Chaque test définit :
- Des **options** (nombre de VUs, durée, scénarios)
- Des **thresholds** (seuils à ne pas dépasser — si dépassés, le test échoue)
- Des **métriques custom** (counters, rates, trends propres au domaine)

---

### `catalog.js` — Charge sur le catalogue

**Scénario** : 4 utilisateurs naviguent dans le catalogue avec des filtres aléatoires.

**Profil de charge** :
```
0s ──── 10s : montée de 0 à 20 VUs
10s ─── 40s : charge nominale à 50 VUs
40s ─── 50s : descente à 0 VU
```

**Thresholds** :

| Métrique | Seuil | Signification |
|----------|-------|---------------|
| `http_req_duration p(95)` | < 500ms | 95% des requêtes répondent en moins de 500ms |
| `http_req_failed rate` | < 1% | Moins de 1% d'erreurs réseau |
| `catalog_latency_ms p(99)` | < 800ms | 99% des requêtes sous 800ms |

**Métriques custom** :
- `cards_returned_total` — nombre total de cartes renvoyées (mesure la cohérence)
- `filter_requests_success` — taux de succès des requêtes filtrées
- `catalog_latency_ms` — latence mesurée côté client (Trend pour les percentiles)

---

### `negotiation.js` — Workflow complet sous charge

**Scénario** : 10 VUs pendant 60s — chaque VU effectue un cycle complet :
1. Axel se connecte et crée une proposition (cartes offertes + demandées + message)
2. Mira se connecte et **accepte ou refuse** (tirage aléatoire 50/50)

**Thresholds** :

| Métrique | Seuil | Signification |
|----------|-------|---------------|
| `http_req_duration p(95)` | < 1000ms | Plus de tolérance (écriture DB plus lente) |
| `http_req_failed rate` | < 5% | Tolérance légèrement plus haute (opérations parallèles) |
| `trades_failed rate` | < 10% | Moins de 10% d'échecs de création de trade |

**Métriques custom** :
- `trades_created` — trades créées avec succès (status 201)
- `trades_accepted` / `trades_refused` — répartition des actions Mira

---

### `concurrent-trade.js` — Test d'atomicité ⚠️ Test critique

**Scénario** : 20 VUs tentent simultanément d'accepter **la même trade PENDING**.

Ce test valide le cœur de la correction anti-race condition implémentée dans `NegotiationCommandService`.

#### Pourquoi ce test existe

Sans protection atomique, le pattern suivant est dangereux sous concurrence :

```
VU 1 : lit trade → status=PENDING → ✅ → UPDATE status=ACCEPTED
VU 2 : lit trade → status=PENDING → ✅ → UPDATE status=ACCEPTED  ← DOUBLE ACCEPTATION
```

Le fix utilise une clause `where` conditionnelle dans Prisma :

```javascript
await prisma.trade.update({
  where: { id: tradeId, status: { in: OPEN_STATUSES } }, // ← atomique au niveau DB
  data: { status: 'ACCEPTED' },
});
// Si la trade a déjà changé de status → Prisma lève P2025 → converti en INVALID_STATUS
```

#### Déroulement

1. **Setup** : connexion d'Axel et Mira, création d'une trade PENDING cible
2. **20 VUs** : chacun tente `POST /api/trades/:id/accept` avec la session Mira
3. **Résultat attendu** :
   - 1 réponse `200` (une seule acceptation)
   - 19 réponses `409 INVALID_STATUS`
   - 0 réponse `500` (pas de deadlock, pas de crash)
4. **Teardown** : vérification que la trade est `ACCEPTED` et que l'historique contient **exactement 1 message ACCEPT**

#### Thresholds — bloquants

| Métrique | Seuil | Impact si dépassé |
|----------|-------|-------------------|
| `accept_success count` | **== 1** | CI bloqué — atomicité violée |
| `server_errors count` | **< 1** | CI bloqué — erreur serveur inattendue |
| `no_server_error_rate rate` | > 99% | CI bloqué |
| `http_req_failed rate` | < 1% | CI bloqué |
| `http_req_duration p(95)` | < 500ms | CI bloqué |

---

## Pipeline CI — GitHub Actions

### Fichier : `.github/workflows/ci.yml`

Le pipeline se déclenche sur chaque **push** ou **pull request** vers `master`/`main`.

```
push/PR
   │
   ▼
┌─────────────────────────┐
│  Job 1 — unit-tests     │  Ubuntu, Node 20, pas de DB
│  npm run test:unit       │  Durée : ~30s
│  Jest — 49 tests         │
└────────────┬────────────┘
             │ needs: unit-tests
             ▼
┌─────────────────────────┐
│  Job 2 — e2e-tests      │  Ubuntu, Node 20 + PostgreSQL 15
│  npm run test:e2e        │  Durée : ~3min
│  Playwright — 22 tests   │
│  Artifact : playwright-report │
└────────────┬────────────┘
             │ needs: e2e-tests
             ▼
┌─────────────────────────┐
│  Job 3 — load-tests     │  Ubuntu, Node 20 + PostgreSQL 15 + k6
│  3 scénarios k6          │  Durée : ~3min
│  Artifact : k6-results   │
└─────────────────────────┘
```

### Séquençage et bloquage

Les jobs sont **strictement séquentiels** via `needs:` :
- Si les tests unitaires échouent → les tests E2E et de charge ne démarrent pas
- Si les tests E2E échouent → les tests de charge ne démarrent pas
- Si les tests de charge échouent → le pipeline est en erreur (bloquant)

### Environnements isolés

Chaque job qui nécessite une DB démarre **sa propre instance PostgreSQL** via `services:` :
- Job 2 : base `swapdeck_test`
- Job 3 : base `swapdeck_load`

Cela garantit l'isolation entre les tests fonctionnels et les tests de charge.

### Artefacts uploadés

| Artefact | Contenu | Rétention |
|----------|---------|-----------|
| `playwright-report` | Rapport HTML Playwright (captures d'écran sur échec) | 7 jours |
| `k6-results` | Résultats JSON des scénarios k6 | 7 jours |

---

## Couverture fonctionnelle globale

| Fonctionnalité | Unit | E2E | Load |
|----------------|:----:|:---:|:----:|
| Création d'une trade | ✅ | ✅ | ✅ |
| Acceptation d'une trade | ✅ | ✅ | ✅ |
| Refus d'une trade | ✅ | ✅ | ✅ |
| Contre-proposition | ✅ | ✅ | — |
| Annulation par l'initiateur | ✅ | — | — |
| Envoi de messages | ✅ | — | — |
| Lecture du catalogue | — | ✅ | ✅ |
| Filtrage par jeu | — | ✅ | ✅ |
| Atomicité (race condition) | ✅ | — | ✅ |
| Gestion des erreurs métier | ✅ | ✅ | — |
| Accès non autorisé | ✅ | ✅ | — |
