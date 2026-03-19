/**
 * Test de charge — Parcours du catalogue
 *
 * Simule N utilisateurs naviguant dans le catalogue avec des filtres variés.
 * Vérifie la tenue en charge des endpoints GET /api/cards.
 *
 * Usage :
 *   k6 run tests/load/catalog.js
 *   k6 run tests/load/catalog.js --vus 100 --duration 60s   # stress test
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Counter, Rate, Trend } from 'k6/metrics';

// ── Métriques custom ──────────────────────────────────
const cardsReturned  = new Counter('cards_returned_total');
const filterHitRate  = new Rate('filter_requests_success');
const catalogLatency = new Trend('catalog_latency_ms', true);

// ── Configuration ─────────────────────────────────────
export const options = {
  stages: [
    { duration: '10s', target: 20 },  // Montée progressive
    { duration: '30s', target: 50 },  // Charge nominale
    { duration: '10s', target: 0  },  // Descente
  ],
  thresholds: {
    http_req_duration:    ['p(95)<500'],  // 95% des requêtes sous 500ms
    http_req_failed:      ['rate<0.01'], // Moins de 1% d'erreurs
    catalog_latency_ms:   ['p(99)<800'], // 99% sous 800ms
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';

const HANDLES = ['axel_d', 'mira_k', 'soren_l', 'camille_t'];
const GAMES   = ['POKEMON', 'MAGIC', 'YUGIOH', 'DIGIMON', '', ''];
// '' apparaît 2x pour augmenter la probabilité de "sans filtre"

// ── Setup : connexion de tous les utilisateurs ─────────
export function setup() {
  const sessions = {};

  for (const handle of HANDLES) {
    const res = http.post(
      `${BASE_URL}/api/auth/login`,
      JSON.stringify({ handle }),
      { headers: { 'Content-Type': 'application/json' } }
    );

    if (res.status !== 200) {
      console.error(`Login échoué pour ${handle}: ${res.status} ${res.body}`);
      continue;
    }

    // Extrait le cookie de session
    const cookieHeader = res.headers['Set-Cookie'] || '';
    const sid = cookieHeader.match(/connect\.sid=([^;]+)/);
    sessions[handle] = sid ? `connect.sid=${sid[1]}` : null;
  }

  console.log(`Sessions ouvertes : ${Object.keys(sessions).length}/4`);
  return sessions;
}

// ── Scénario principal ────────────────────────────────
export default function (sessions) {
  const handle = HANDLES[Math.floor(Math.random() * HANDLES.length)];
  const game   = GAMES[Math.floor(Math.random() * GAMES.length)];
  const cookie = sessions[handle];

  if (!cookie) {
    console.warn(`Session manquante pour ${handle}`);
    return;
  }

  const url = game
    ? `${BASE_URL}/api/cards?game=${game}`
    : `${BASE_URL}/api/cards`;

  const start = Date.now();
  const res   = http.get(url, { headers: { Cookie: cookie } });
  catalogLatency.add(Date.now() - start);

  const ok = check(res, {
    'status 200':       (r) => r.status === 200,
    'contient cards':   (r) => {
      try { return Array.isArray(r.json('cards')); } catch { return false; }
    },
  });

  filterHitRate.add(ok);

  if (res.status === 200) {
    try {
      const cards = res.json('cards');
      cardsReturned.add(cards.length);
    } catch (_) {}
  }

  sleep(0.5 + Math.random());   // Pause réaliste entre 0.5s et 1.5s
}

// ── Teardown : résumé ─────────────────────────────────
export function teardown() {
  console.log('Test catalogue terminé.');
}
