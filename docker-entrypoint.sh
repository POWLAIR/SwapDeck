#!/bin/sh
set -e

echo "[SwapDeck] Synchronisation du schéma de base de données..."
cd /app/backend

# prisma db push : applique le schéma sans fichier de migration.
# Pour un déploiement production avec historique de migrations,
# remplacer par : ./node_modules/.bin/prisma migrate deploy
./node_modules/.bin/prisma db push --accept-data-loss

echo "[SwapDeck] Démarrage du serveur..."
exec node src/server.js
