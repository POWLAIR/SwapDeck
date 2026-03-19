# Tests de charge — SwapDeck (k6)

## Prérequis

- [k6](https://k6.io/docs/get-started/installation/) installé localement
- L'application SwapDeck démarrée (Docker ou local)

### Installer k6

```bash
# macOS
brew install k6

# Linux (Debian/Ubuntu)
sudo gpg -k
sudo gpg --no-default-keyring --keyring /usr/share/keyrings/k6-archive-keyring.gpg \
  --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" \
  | sudo tee /etc/apt/sources.list.d/k6.list
sudo apt-get update && sudo apt-get install k6

# Windows (winget)
winget install k6 --source winget
```

---

## Démarrer l'application

```bash
# Via Docker (recommandé)
docker compose up --build -d

# Ou en local (nécessite PostgreSQL)
cp .env.example .env   # renseigner DATABASE_URL
cd backend && npm install
cd .. && npm run db:seed
npm run dev
```

---

## Scripts disponibles

### 1. `catalog.js` — Charge sur le catalogue

Simule 50 utilisateurs naviguant dans le catalogue avec des filtres aléatoires.

```bash
k6 run tests/load/catalog.js

# Stress test
k6 run tests/load/catalog.js --vus 100 --duration 60s
```

**Thresholds :**
- p(95) < 500ms
- Taux d'erreur < 1%

---

### 2. `negotiation.js` — Workflow de négociation sous charge

10 VUs créent chacun une trade complète (proposition + acceptation/refus).

```bash
k6 run tests/load/negotiation.js

# Plus de charge
k6 run tests/load/negotiation.js --vus 20 --duration 90s
```

**Thresholds :**
- p(95) < 1000ms
- Taux d'erreur < 5%

---

### 3. `concurrent-trade.js` — Échange concurrent du même objet ⭐

Test critique : 20 VUs tentent simultanément d'accepter la même trade.
Vérifie l'absence de deadlock, de doublon et d'incohérence d'état.

```bash
k6 run tests/load/concurrent-trade.js
```

**Résultat attendu :**
```
accept_success  ✓ = 1   (exactement une acceptation)
accept_conflict ✓ ≈ 19  (les autres reçoivent 409)
server_errors   ✓ = 0   (aucun deadlock / erreur 500)
Statut final de la trade : ACCEPTED
```

**Threshold bloquant :**
- `server_errors count < 1` — aucune erreur 500 tolérée

---

## Lire les résultats

k6 affiche un résumé à la fin de chaque test :

```
  ✓ status 200
  ✓ contient cards

  checks.........................: 100.00% ✓ 1500 ✗ 0
  data_received..................: 2.1 MB  42 kB/s
  http_req_duration..............: avg=45ms  p(95)=120ms
  http_req_failed................: 0.00%  ✓ 0 ✗ 1500
  vus............................: 50      min=0 max=50
```

Les thresholds apparaissent avec ✓ (passé) ou ✗ (échoué).

---

## En CI (GitHub Actions)

Les tests de charge s'exécutent automatiquement dans le job `load-tests`,
après la validation des tests unitaires et fonctionnels.

Le job est `continue-on-error: true` : un échec des tests de charge
n'empêche pas le pipeline de se terminer en succès.

Les résultats sont disponibles dans les **Artifacts** du workflow GitHub Actions.
