# SwapDeck 🃏

> Plateforme de troc de cartes de collection — aucun flux monétaire, tout repose sur l'échange et la négociation.

## Concept

SwapDeck permet aux collectionneurs de cartes (Pokémon, Magic: The Gathering, Yu-Gi-Oh!, Digimon…) d'échanger leurs cartes entre eux sans aucune transaction financière. La valeur est négociée librement entre les utilisateurs via un système de propositions et de contre-propositions.

---

## Stack technique

| Couche | Technologie |
| ------ | ----------- |
| Frontend | HTML5 / CSS3 / JavaScript ES Modules (vanilla) |
| Backend | Node.js + Express |
| ORM | Prisma |
| Base de données | PostgreSQL |
| Tests fonctionnels | Playwright |
| Tests unitaires | Jest |

---

## Phase 1 — MVP

### Fonctionnalités

- **Identification** : sélection parmi 4 utilisateurs prédéfinis (sans mot de passe)
- **Catalogue** : affichage de toutes les cartes avec filtres par jeu (Pokémon, Magic, Yu-Gi-Oh!, Digimon)
- **Ma collection** : cartes attribuées à l'utilisateur par l'administrateur en base de données
- **Proposition d'échange** : sélection de cartes à offrir et à demander, message obligatoire
- **Négociation** : le destinataire peut Accepter, Refuser ou Contre-proposer
- **Historique** : tous les messages d'une transaction sont conservés et affichés chronologiquement

### Utilisateurs prédéfinis

| Handle | Nom | Spécialité |
| ------ | --- | ---------- |
| `axel_d` | Axel D. | Pokémon |
| `mira_k` | Mira K. | Magic: The Gathering |
| `soren_l` | Soren L. | Yu-Gi-Oh! |
| `camille_t` | Camille T. | Tous genres |

### Administration des cartes

Les cartes sont gérées directement en base par l'administrateur via Prisma Studio :

```bash
npm run db:studio   # Ouvre http://localhost:5555
```

---

## Phase 2 — Tests & CQRS

### Tests fonctionnels (Playwright)

Couverture des fonctionnalités de **parcours du catalogue** et de **négociation** :

- Cas usuels : affichage des cartes, filtres, proposition, acceptation, refus, contre-proposition
- Cas extrêmes : chaîne de contre-propositions, longs messages, double acceptation
- Cas d'erreur : proposition sans carte, sans message, auto-acceptation impossible, accès sans session

```bash
npm run test:e2e
```

### Patron CQRS

Le patron CQRS sépare les **commandes** (mutations) des **requêtes** (lectures) au niveau de la couche service.

#### NegotiationCommandService — Write Side

| Méthode | Action |
| ------- | ------ |
| `createTrade` | Crée une proposition d'échange |
| `acceptTrade` | Accepte (destinataire uniquement) |
| `refuseTrade` | Refuse (destinataire uniquement) |
| `counterTrade` | Contre-propose (crée une nouvelle trade liée) |
| `cancelTrade` | Annule (initiateur uniquement, si encore en attente) |
| `addMessage` | Ajoute un commentaire libre |

#### NegotiationQueryService — Read Side

| Méthode | Action |
| ------- | ------ |
| `getTradeById` | Détail complet (participants uniquement) |
| `getTradesForUser` | Liste paginée filtrée par rôle et statut |
| `getNegotiationThread` | Chaîne complète des contre-propositions |
| `getTradeMessages` | Historique des messages |

### Tests unitaires (Jest)

Les deux services CQRS sont testés indépendamment avec mock du client Prisma — aucune base de données nécessaire.

```bash
npm run test:unit
```

---

## Phase 3 — CI/CD & Tests de charge

### Pipeline GitHub Actions

Le workflow `.github/workflows/ci.yml` enchaîne trois jobs bloquants :

| Job | Outil | Condition |
| --- | ----- | --------- |
| `unit-tests` | Jest (sans DB) | Toujours exécuté |
| `e2e-tests` | Playwright + PostgreSQL | Dépend de `unit-tests` |
| `load-tests` | k6 + PostgreSQL | Dépend de `e2e-tests` |

Le pipeline s'interrompt dès qu'un job échoue. Les artefacts Playwright et k6 sont uploadés pour consultation (rétention 7 jours).

### Tests de charge (k6)

```bash
# Depuis la racine du projet (serveur déjà lancé sur :3000)
k6 run tests/load/catalog.js          # 50 VUs — parcours catalogue
k6 run tests/load/negotiation.js      # 10 VUs — workflow complet
k6 run tests/load/concurrent-trade.js # 20 VUs — acceptation concurrente du même objet
```

Le test `concurrent-trade.js` valide l'**atomicité de la machine d'états** :
- Exactement 1 acceptation réussie (`accept_success == 1`)
- 19 refus concurrents attendus (409 INVALID_STATUS)
- Aucune erreur serveur (pas de deadlock ni d'incohérence d'historique)

### Docker

```bash
# Lancement complet (DB + migrations + seed + app)
docker compose up

# En mode detach
docker compose up -d
```

---

## Installation & lancement

### Prérequis

- Node.js >= 18
- PostgreSQL >= 14

### Démarrage

```bash
# 1. Variables d'environnement
cp .env.example .env
# → Renseigner DATABASE_URL=postgresql://USER:PASSWORD@localhost:5432/swapdeck

# 2. Dépendances
cd backend && npm install
cd .. && npm install

# 3. Base de données
npm run db:migrate   # Crée les tables
npm run db:seed      # Insère les 4 utilisateurs + 16 cartes de démo

# 4. Lancer
npm run dev          # http://localhost:3000
```

### Tests

```bash
npm run test:unit    # Tests Jest (sans DB)
npm run test:e2e     # Tests Playwright (démarre le serveur automatiquement)
```

---

## Structure du projet

```text
SwapDeck/
├── backend/
│   ├── prisma/
│   │   ├── schema.prisma          # Modèles : User, Card, Trade, TradeCard, Message
│   │   └── seed.js                # Données de démo
│   └── src/
│       ├── server.js / app.js
│       ├── middleware/            # Auth session + gestion d'erreurs
│       ├── routes/                # auth, cards, trades, messages
│       ├── controllers/           # Couche HTTP (fins, délèguent aux services)
│       └── services/
│           ├── NegotiationCommandService.js   # CQRS — Write
│           ├── NegotiationQueryService.js     # CQRS — Read
│           └── card.service.js
├── frontend/
│   ├── index.html                 # SPA (routage par hash)
│   ├── css/                       # main.css + components.css
│   └── js/                        # api, app, auth, catalog, trade, negotiation
├── tests/
│   ├── unit/                      # Jest — NegotiationCommandService + QueryService
│   └── e2e/                       # Playwright — catalog.spec + negotiation.spec
└── docs/PLAN.md                   # Plan détaillé + documentation API
```

---

*Projet réalisé dans le cadre du cours Tests Logiciels — EFREI Paris*
