/**
 * Test de charge — Workflow de négociation complet
 *
 * Chaque VU simule un cycle de négociation :
 *   1. Axel se connecte et crée une proposition vers Mira
 *   2. Mira se connecte et accepte ou refuse (aléatoire)
 *
 * Vérifie la tenue en charge de la logique métier de négociation.
 *
 * Usage :
 *   k6 run tests/load/negotiation.js
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Counter, Rate } from 'k6/metrics';

// ── Métriques custom ──────────────────────────────────
const tradesCreated  = new Counter('trades_created');
const tradesAccepted = new Counter('trades_accepted');
const tradesRefused  = new Counter('trades_refused');
const tradesFailed   = new Rate('trades_failed');

// ── Configuration ─────────────────────────────────────
export const options = {
  vus:      10,
  duration: '60s',
  thresholds: {
    http_req_duration: ['p(95)<1000'],  // Négociation plus lente → tolérance 1s
    http_req_failed:   ['rate<0.05'],   // <5% d'erreurs globales
    trades_failed:     ['rate<0.10'],   // <10% d'échecs de création de trade
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
const JSON_HEADERS = { 'Content-Type': 'application/json' };

// ── Helpers ───────────────────────────────────────────

function login(handle) {
  // Vide le jar pour éviter la fusion de sessions entre utilisateurs
  http.cookieJar().clear(BASE_URL);

  const res = http.post(
    `${BASE_URL}/api/auth/login`,
    JSON.stringify({ handle }),
    { headers: JSON_HEADERS }
  );
  if (res.status !== 200) return null;

  const cookieHeader = res.headers['Set-Cookie'] || '';
  const sid = cookieHeader.match(/connect\.sid=([^;]+)/);
  return sid ? `connect.sid=${sid[1]}` : null;
}

function getCards(cookie, ownerId = null) {
  const url = ownerId
    ? `${BASE_URL}/api/cards?ownerId=${ownerId}`
    : `${BASE_URL}/api/cards`;
  const res = http.get(url, { headers: { Cookie: cookie } });
  if (res.status !== 200) return [];
  try { return res.json('cards'); } catch { return []; }
}

// ── Setup : récupération des IDs utilisateurs ─────────
export function setup() {
  const axelCookie = login('axel_d');
  if (!axelCookie) {
    console.error('Impossible de se connecter avec axel_d');
    return {};
  }

  // Récupère les cartes pour identifier les IDs des users
  const allCards = getCards(axelCookie);
  const userIds = {};

  for (const card of allCards) {
    if (!userIds[card.owner.handle]) {
      userIds[card.owner.handle] = card.owner.id;
    }
  }

  console.log('User IDs récupérés :', JSON.stringify(userIds));
  return { userIds };
}

// ── Scénario principal ────────────────────────────────
export default function ({ userIds }) {
  if (!userIds || !Object.keys(userIds).length) {
    console.warn('Setup invalide, skip');
    return;
  }

  // 1. Axel se connecte
  const axelCookie = login('axel_d');
  if (!axelCookie) { tradesFailed.add(1); return; }

  // 2. Récupère les cartes de Mira (pour en demander)
  const miraCookie = login('mira_k');
  if (!miraCookie) { tradesFailed.add(1); return; }

  const axelCards = getCards(axelCookie, userIds['axel_d']);
  const miraCards = getCards(miraCookie, userIds['mira_k']);

  if (!axelCards.length || !miraCards.length) {
    tradesFailed.add(1);
    return;
  }

  // 3. Crée une proposition : offre 1 carte Axel, demande 1 carte Mira
  const offered   = [axelCards[0].id];
  const requested = [miraCards[0].id];

  const createRes = http.post(
    `${BASE_URL}/api/trades`,
    JSON.stringify({
      recipientId:    userIds['mira_k'],
      offeredCardIds:   offered,
      requestedCardIds: requested,
      message: `Proposition de test k6 — VU ${__VU}`,
    }),
    { headers: { ...JSON_HEADERS, Cookie: axelCookie } }
  );

  const created = check(createRes, {
    'trade créée (201)': (r) => r.status === 201,
  });

  if (!created) {
    tradesFailed.add(1);
    return;
  }

  tradesCreated.add(1);

  let tradeId;
  try { tradeId = createRes.json('trade.id'); } catch { return; }

  sleep(0.5);

  // 4. Mira accepte ou refuse (50/50)
  const action = Math.random() < 0.5 ? 'accept' : 'refuse';
  const actionRes = http.post(
    `${BASE_URL}/api/trades/${tradeId}/${action}`,
    null,
    { headers: { Cookie: miraCookie } }
  );

  check(actionRes, {
    'action réussie (200)': (r) => r.status === 200,
  });

  if (action === 'accept') tradesAccepted.add(1);
  else                     tradesRefused.add(1);

  sleep(1);
}
