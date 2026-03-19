# Plan de mise en place — SwapDeck

## Vue d'ensemble

SwapDeck est une plateforme de troc de cartes de collection (Pokémon, Magic, Yu-Gi-Oh!, Digimon).
Aucun flux monétaire : tout repose sur l'échange et la négociation entre utilisateurs.

---

## Stack technique

| Couche | Technologie |
|--------|-------------|
| Frontend | HTML5 / CSS3 / JavaScript ES Modules (vanilla) |
| Backend | Node.js + Express |
| ORM | Prisma |
| Base de données | PostgreSQL |
| Tests E2E | Playwright |
| Tests unitaires | Jest |
| Déploiement MVP | `node server.js` (local) → Vercel/Railway (prod) |

---

## Structure du projet

```
SwapDeck/
├── .env.example              # Variables d'environnement à copier en .env
├── .gitignore
├── package.json              # Scripts racine (dev, test, db:*)
├── docs/
│   └── PLAN.md              # Ce fichier
│
├── backend/
│   ├── package.json
│   ├── prisma/
│   │   ├── schema.prisma    # Modèles : User, Card, Trade, TradeCard, Message
│   │   └── seed.js          # 4 utilisateurs + 16 cartes de démo
│   └── src/
│       ├── server.js        # Point d'entrée HTTP
│       ├── app.js           # Express + middlewares + routes
│       ├── config/db.js     # Singleton Prisma Client
│       ├── middleware/
│       │   ├── auth.js      # Vérification session + attache req.user
│       │   └── errorHandler.js
│       ├── routes/          # 4 fichiers de routes (auth, card, trade, message)
│       ├── controllers/     # 4 contrôleurs (fins, délèguent aux services)
│       └── services/
│           ├── NegotiationCommandService.js  # CQRS — Write
│           ├── NegotiationQueryService.js    # CQRS — Read
│           └── card.service.js
│
├── frontend/
│   ├── index.html           # SPA shell
│   ├── css/
│   │   ├── main.css         # Variables, layout, utilitaires
│   │   └── components.css   # Card grid, badges, thread, formulaires
│   └── js/
│       ├── api.js           # Wrapper fetch centralisé
│       ├── app.js           # Routeur hash-based + init session
│       ├── auth.js          # Sélecteur d'utilisateur
│       ├── catalog.js       # Affichage + filtres du catalogue
│       ├── trade.js         # Liste des échanges + formulaire de proposition
│       └── negotiation.js   # Fil de négociation + actions
│
└── tests/
    ├── unit/
    │   ├── NegotiationCommandService.test.js
    │   └── NegotiationQueryService.test.js
    └── e2e/
        ├── playwright.config.js
        ├── catalog.spec.js
        └── negotiation.spec.js
```

---

## Schéma de la base de données

```
User          Card           Trade           TradeCard       Message
────────      ────────────   ─────────────   ───────────     ────────────
id            id             id              id              id
name          name           initiatorId ──► tradeId ──►     tradeId ──►
handle        description    recipientId     cardId ──►       authorId ──►
avatar        game (enum)    status (enum)   direction        body
              rarity (enum)  parentTradeId   (OFFERED /       action (enum)
              imageUrl       createdAt       REQUESTED)       createdAt
              ownerId ──►    updatedAt
```

### Enums

- **CardGame** : `POKEMON | MAGIC | YUGIOH | DIGIMON | OTHER`
- **Rarity** : `COMMON | UNCOMMON | RARE | ULTRA_RARE | SECRET_RARE`
- **TradeStatus** : `PENDING | ACCEPTED | REFUSED | COUNTERED | CANCELLED`
- **MessageAction** : `PROPOSE | ACCEPT | REFUSE | COUNTER | COMMENT`

### Décisions clés

1. **Contre-proposition = nouvelle Trade** liée par `parentTradeId`.
   Cela préserve l'historique complet sans table de log séparée.
2. **Junction table `TradeCard`** avec champ `direction` (`OFFERED`/`REQUESTED`)
   pour distinguer ce qu'on offre de ce qu'on demande.
3. **Pas de mot de passe** : login par `handle` uniquement (MVP scolaire).

---

## Patron CQRS (Phase 2)

Le patron CQRS sépare les **commandes** (mutations d'état) des **requêtes** (lectures).

### NegotiationCommandService — Write Side

| Méthode | Description |
|---------|-------------|
| `createTrade` | Crée une proposition avec cartes + message initial |
| `acceptTrade` | Passe le statut à `ACCEPTED` (destinataire uniquement) |
| `refuseTrade` | Passe le statut à `REFUSED` (destinataire uniquement) |
| `counterTrade` | Marque l'originale `COUNTERED`, crée une nouvelle trade |
| `cancelTrade` | Annule si encore `PENDING` (initiateur uniquement) |
| `addMessage` | Ajoute un commentaire libre sur une trade ouverte |

### NegotiationQueryService — Read Side

| Méthode | Description |
|---------|-------------|
| `getTradeById` | Détail complet (gardes d'accès : participant uniquement) |
| `getTradesForUser` | Liste paginée, filtrée par rôle et statut |
| `getNegotiationThread` | Chaîne complète des contre-propositions |
| `getTradeMessages` | Historique des messages d'une trade |

---

## Mise en place pas à pas

### Prérequis

```bash
# Outils requis
node >= 18
npm >= 9
PostgreSQL >= 14 (en local ou via Docker)
```

### 1. Installation

```bash
# Copier les variables d'environnement
cp .env.example .env
# Éditer .env avec votre DATABASE_URL

# Installer les dépendances backend
cd backend && npm install

# Installer Playwright (tests E2E)
cd .. && npm install
npx playwright install chromium
```

### 2. Base de données

```bash
# Créer les tables (migration)
npm run db:migrate

# Insérer les données de démo (4 users + 16 cartes)
npm run db:seed

# Interface graphique pour administrer les cartes
npm run db:studio
```

### 3. Lancer le serveur

```bash
npm run dev        # Avec rechargement automatique (nodemon)
# ou
npm start          # Production
```

L'application est accessible sur `http://localhost:3000`.

### 4. Lancer les tests

```bash
# Tests unitaires (Jest, pas de DB nécessaire)
npm run test:unit

# Tests fonctionnels (Playwright, démarre le serveur automatiquement)
# Prérequis : DB migrée et seedée
npm run test:e2e

# Rapport HTML des tests E2E
npx playwright show-report
```

---

## Administration des cartes

Pour ajouter des cartes (comme en production) :

```bash
npm run db:studio
# → Ouvre Prisma Studio sur http://localhost:5555
# → Naviguer dans "Card" → "Add record"
# → Renseigner : name, description, game, rarity, imageUrl, ownerId
```

Ou directement en SQL :
```sql
INSERT INTO "Card" (name, description, game, rarity, "imageUrl", "ownerId", "createdAt")
VALUES ('Dracaufeu', 'Le dragon légendaire', 'POKEMON', 'ULTRA_RARE', '/assets/placeholder-card.png', 1, NOW());
```

---

## API REST — Résumé des endpoints

### Auth
| Méthode | Route | Description |
|---------|-------|-------------|
| POST | `/api/auth/login` | `{ handle }` → ouvre la session |
| POST | `/api/auth/logout` | Ferme la session |
| GET  | `/api/auth/me` | Utilisateur courant |

### Cartes
| Méthode | Route | Description |
|---------|-------|-------------|
| GET | `/api/cards` | Catalogue (filtres : `game`, `ownerId`) |
| GET | `/api/cards/:id` | Détail d'une carte |

### Échanges
| Méthode | Route | Description |
|---------|-------|-------------|
| POST | `/api/trades` | Créer une proposition |
| GET  | `/api/trades` | Liste (filtres : `role`, `status`, `page`) |
| GET  | `/api/trades/:id` | Détail complet |
| POST | `/api/trades/:id/accept` | Accepter |
| POST | `/api/trades/:id/refuse` | Refuser |
| POST | `/api/trades/:id/counter` | Contre-proposer |
| POST | `/api/trades/:id/cancel` | Annuler |

### Messages
| Méthode | Route | Description |
|---------|-------|-------------|
| GET  | `/api/trades/:id/messages` | Historique des messages |
| POST | `/api/trades/:id/messages` | Ajouter un commentaire |

---

## Roadmap (post-MVP)

- [ ] Authentification JWT + inscription
- [ ] Upload d'images de cartes (Cloudinary/S3)
- [ ] Notifications temps réel (WebSocket)
- [ ] Système de réputation post-échange
- [ ] Mode mobile optimisé (PWA)
