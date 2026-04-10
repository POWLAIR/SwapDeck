/**
 * Test de charge — Échange concurrent du même objet
 *
 * Scénario critique : 20 VUs tentent simultanément d'accepter
 * la même trade PENDING. Le système ne doit produire :
 *   - qu'UN SEUL statut ACCEPTED
 *   - aucune erreur 500 (pas de deadlock, pas d'incohérence)
 *   - aucune réponse en double (les 19 autres → 409 INVALID_STATUS)
 *
 * Ce test valide la robustesse de la machine d'états de négociation
 * face à la concurrence.
 *
 * Usage :
 *   k6 run tests/load/concurrent-trade.js
 *   k6 run tests/load/concurrent-trade.js --vus 50 --iterations 50  # stress
 */

import http from 'k6/http';
import { check } from 'k6';
import { Counter, Rate } from 'k6/metrics';

// Indique à k6 que 2xx, 409 et 403 ne sont PAS des échecs réseau.
// Sans cela, les 409 attendus (INVALID_STATUS) gonfleraient http_req_failed
// et feraient rater le threshold à tort.
http.setResponseCallback(http.expectedStatuses({ min: 200, max: 499 }));

// ── Métriques custom ──────────────────────────────────
const acceptSuccess  = new Counter('accept_success');   // Doit être = 1
const acceptConflict = new Counter('accept_conflict');  // 409 — attendu
const serverError    = new Counter('server_errors');    // 500 — NON attendu
const noServerError  = new Rate('no_server_error_rate');

// ── Configuration ─────────────────────────────────────
// executor: shared-iterations → les 20 VUs se partagent
// exactement 20 itérations lancées AU MÊME MOMENT.
export const options = {
  scenarios: {
    concurrent_accept: {
      executor:        'shared-iterations',
      vus:             20,
      iterations:      20,
      maxDuration:     '30s',
      gracefulStop:    '5s',
    },
  },
  thresholds: {
    // Les 409 ne sont PAS des erreurs réseau k6 (status != 0)
    // http_req_failed ne compte que les erreurs réseau/timeout
    http_req_failed:      ['rate<0.01'],
    http_req_duration:    ['p(95)<500'],
    // Exactement UNE acceptation doit réussir (atomicité du statut)
    accept_success:       ['count==1'],
    // Aucune erreur serveur ne doit survenir (pas de deadlock)
    server_errors:        ['count<1'],
    no_server_error_rate: ['rate>0.99'],
  },
};

const BASE_URL    = __ENV.BASE_URL || 'http://localhost:3000';
const JSON_HEADERS = { 'Content-Type': 'application/json' };

// ── Helpers ───────────────────────────────────────────

/**
 * Connecte un utilisateur et retourne son cookie de session.
 * Vide le jar k6 avant l'appel pour éviter que les sessions précédentes
 * (stockées automatiquement par k6 via Set-Cookie) ne soient fusionnées
 * avec le header Cookie manuel des requêtes suivantes.
 */
function login(handle) {
  // Vide le jar pour ce domaine afin qu'aucun cookie résiduel
  // ne soit injecté automatiquement dans la requête de login.
  http.cookieJar().clear(BASE_URL);

  const res = http.post(
    `${BASE_URL}/api/auth/login`,
    JSON.stringify({ handle }),
    { headers: JSON_HEADERS }
  );
  if (res.status !== 200) {
    console.error(`Login échoué pour ${handle}: ${res.status}`);
    return null;
  }
  const cookieHeader = res.headers['Set-Cookie'] || '';
  const sid = cookieHeader.match(/connect\.sid=([^;]+)/);
  return sid ? `connect.sid=${sid[1]}` : null;
}

function getUserCards(cookie, userId) {
  const res = http.get(
    `${BASE_URL}/api/cards?ownerId=${userId}`,
    { headers: { Cookie: cookie } }
  );
  if (res.status !== 200) return [];
  try { return res.json('cards'); } catch { return []; }
}

// ── Setup : crée une trade PENDING cible ──────────────
export function setup() {
  // Connexion des deux participants
  const axelCookie = login('axel_d');
  const miraCookie  = login('mira_k');

  if (!axelCookie || !miraCookie) {
    console.error('Impossible de se connecter');
    return null;
  }

  // Récupère les cartes
  const meRes  = http.get(`${BASE_URL}/api/auth/me`, { headers: { Cookie: axelCookie } });
  const meRes2 = http.get(`${BASE_URL}/api/auth/me`, { headers: { Cookie: miraCookie } });

  let axelId, miraId;
  try {
    axelId = meRes.json('user.id');
    miraId  = meRes2.json('user.id');
  } catch {
    console.error('Impossible de récupérer les IDs utilisateurs');
    return null;
  }

  const axelCards = getUserCards(axelCookie, axelId);
  const miraCards  = getUserCards(miraCookie, miraId);

  if (!axelCards.length || !miraCards.length) {
    console.error('Aucune carte disponible');
    return null;
  }

  // Vide le jar avant la requête critique pour garantir qu'aucune session
  // résiduelle (ex. miraCookie) n'est fusionnée avec axelCookie.
  http.cookieJar().clear(BASE_URL);

  // Crée la trade cible (Axel → Mira)
  const createRes = http.post(
    `${BASE_URL}/api/trades`,
    JSON.stringify({
      recipientId:      miraId,
      offeredCardIds:   [axelCards[0].id],
      requestedCardIds: [miraCards[0].id],
      message:          'Trade cible pour le test de concurrence k6',
    }),
    { headers: { ...JSON_HEADERS, Cookie: axelCookie } }
  );

  if (createRes.status !== 201) {
    console.error(`Création de trade échouée : ${createRes.status} ${createRes.body}`);
    return null;
  }

  const tradeId = createRes.json('trade.id');
  console.log(`Trade cible créée : ID=${tradeId} | Mira va tenter de l'accepter 20x simultanément`);

  return { tradeId, miraCookie };
}

// ── Scénario : 20 VUs tentent d'accepter en même temps ─
export default function (data) {
  if (!data || !data.tradeId) {
    console.warn('Setup invalide, VU ignoré');
    return;
  }

  const { tradeId, miraCookie } = data;

  const res = http.post(
    `${BASE_URL}/api/trades/${tradeId}/accept`,
    null,
    { headers: { Cookie: miraCookie } }
  );

  // Comptage par statut
  if (res.status === 200)  acceptSuccess.add(1);
  if (res.status === 409)  acceptConflict.add(1);
  if (res.status >= 500)   serverError.add(1);

  const safe = res.status < 500;
  noServerError.add(safe);

  check(res, {
    'pas d\'erreur serveur (pas de 500)':    (r) => r.status !== 500,
    'réponse valide (200 ou 409 ou 403)':    (r) => [200, 409, 403].includes(r.status),
  });
}

// ── Teardown : vérification de l'état final et de l'historique ───────────
export function teardown(data) {
  if (!data || !data.tradeId || !data.miraCookie) return;

  const headers = { Cookie: data.miraCookie };

  // Statut final de la trade
  const tradeRes = http.get(
    `${BASE_URL}/api/trades/${data.tradeId}`,
    { headers }
  );

  let finalStatus = 'inconnu';
  try { finalStatus = tradeRes.json('trade.status'); } catch (_) {}

  // Historique des messages — doit contenir exactement UN message ACCEPT
  const msgRes = http.get(
    `${BASE_URL}/api/trades/${data.tradeId}/messages`,
    { headers }
  );

  let acceptMessages = [];
  try {
    const messages = msgRes.json('messages') || [];
    acceptMessages = messages.filter((m) => m.action === 'ACCEPT');
  } catch (_) {}

  // Assertions sur la cohérence de l'historique
  check(null, {
    'la trade est dans le statut ACCEPTED':          () => finalStatus === 'ACCEPTED',
    "exactement 1 message ACCEPT dans l'historique": () => acceptMessages.length === 1,
  });

  console.log('');
  console.log('═══════════════════════════════════════════════');
  console.log('  Résultat du test de concurrence');
  console.log('═══════════════════════════════════════════════');
  console.log(`  Trade ID          : ${data.tradeId}`);
  console.log(`  Statut final      : ${finalStatus}`);
  console.log(`  Messages ACCEPT   : ${acceptMessages.length} (attendu: 1)`);
  console.log('');
  console.log('  Attendu :');
  console.log('    accept_success  = 1  (exactement une acceptation)');
  console.log('    accept_conflict ≈ 19 (les autres → 409)');
  console.log('    server_errors   = 0  (aucun deadlock)');
  console.log('═══════════════════════════════════════════════');
}
