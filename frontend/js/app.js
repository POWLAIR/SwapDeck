import { api } from './api.js';
import { renderAuthScreen, renderCurrentUser } from './auth.js';
import { renderCatalog } from './catalog.js';
import { renderTrades, openTradeForm } from './trade.js';
import { renderNegotiationThread } from './negotiation.js';
import { injectCardImages } from './card-images.js';

let currentUser = null;

async function init() {
  try {
    const { user } = await api.me();
    currentUser = user;
    showApp();
  } catch {
    showAuth();
  }
}

function showAuth() {
  renderAuthScreen((user) => {
    currentUser = user;
    showApp();
  });
}

function showApp() {
  document.getElementById('auth-overlay').classList.add('hidden');
  document.getElementById('app').classList.remove('hidden');

  renderCurrentUser(currentUser);
  setupLogout();
  setupNavHighlight();
  refreshNavBadge();

  window.addEventListener('hashchange', route);
  route();
}

function route() {
  const hash = window.location.hash || '#catalog';
  const main = document.getElementById('main-content');

  document.querySelectorAll('.nav-link').forEach((l) => {
    l.classList.toggle('active', hash.startsWith('#' + l.dataset.page));
  });

  // Rafraîchit le badge à chaque navigation
  refreshNavBadge();

  if (hash.startsWith('#trade/')) {
    const tradeId = parseInt(hash.split('/')[1]);
    renderNegotiationThread(main, tradeId, currentUser);
  } else if (hash === '#catalog') {
    renderCatalog(main, currentUser);
  } else if (hash === '#collection') {
    renderCollection(main, currentUser);
  } else if (hash === '#trades') {
    renderTrades(main, currentUser);
  } else {
    renderCatalog(main, currentUser);
  }
}

// ── Badge "trades reçus en attente" sur le lien de navigation ───────────────
async function refreshNavBadge() {
  try {
    const { total } = await api.getTrades({ role: 'received', status: 'PENDING' });
    const link  = document.querySelector('[data-page="trades"]');
    if (!link) return;

    let badge = document.getElementById('nav-trades-badge');
    if (total > 0) {
      if (!badge) {
        badge = document.createElement('span');
        badge.id = 'nav-trades-badge';
        badge.className = 'nav-badge';
        link.appendChild(badge);
      }
      badge.textContent = total;
    } else {
      badge?.remove();
    }
  } catch {
    // Silencieux : le badge est cosmétique
  }
}

// ── Page Ma collection ───────────────────────────────────────────────────────
async function renderCollection(container, user) {
  container.innerHTML = `
    <div class="page-header">
      <h1 class="page-title">🗂️ Ma collection</h1>
      <button id="btn-propose-collection" class="btn btn-primary">+ Proposer un échange</button>
    </div>
    <div id="collection-content">
      <div class="loading-state">Chargement…</div>
    </div>
  `;

  container.querySelector('#btn-propose-collection').addEventListener('click', () => {
    openTradeForm(currentUser);
  });

  try {
    const { cards } = await api.getCards({ ownerId: user.id });

    if (!cards.length) {
      container.querySelector('#collection-content').innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">🗂️</div>
          <p>Vous n'avez aucune carte pour l'instant.<br>
             Contactez un administrateur via Prisma Studio pour en recevoir.</p>
        </div>`;
      return;
    }

    const RARITY_BADGE = {
      COMMON:      'badge-common',
      UNCOMMON:    'badge-uncommon',
      RARE:        'badge-rare',
      ULTRA_RARE:  'badge-ultra-rare',
      SECRET_RARE: 'badge-secret-rare',
    };
    const RARITY_LABEL = {
      COMMON:      'Commune',
      UNCOMMON:    'Peu commune',
      RARE:        'Rare',
      ULTRA_RARE:  'Ultra Rare',
      SECRET_RARE: 'Secrète',
    };
    const GAME_ICONS = { POKEMON: '🔥', MAGIC: '✨', YUGIOH: '⚡', DIGIMON: '🌙', OTHER: '🃏' };

    const collectionContent = container.querySelector('#collection-content');
    collectionContent.innerHTML = `
      <p class="text-muted text-sm mb-2">${cards.length} carte${cards.length > 1 ? 's' : ''} dans votre collection</p>
      <div class="card-grid">
        ${cards.map((c) => `
          <div class="card-tile">
            <div class="card-image-placeholder card-image-placeholder--${c.game.toLowerCase()}"
                 data-card-game="${c.game}"
                 data-card-name="${escapeHTML(c.name)}">
              ${GAME_ICONS[c.game] || '🃏'}
            </div>
            <div class="card-info">
              <div class="card-name" title="${escapeHTML(c.name)}">${escapeHTML(c.name)}</div>
              <div class="card-meta">
                <span class="badge badge-${c.game.toLowerCase()}">${c.game}</span>
                <span class="badge ${RARITY_BADGE[c.rarity]}">${RARITY_LABEL[c.rarity]}</span>
              </div>
              <p class="card-description">${escapeHTML(c.description)}</p>
              <div class="card-actions mt-1">
                <button
                  class="btn btn-ghost btn-sm btn-propose-own"
                  data-offer-card="${c.id}">
                  Proposer cette carte
                </button>
              </div>
            </div>
          </div>
        `).join('')}
      </div>`;

    // Injection progressive des vraies images
    injectCardImages(collectionContent);

    // Bouton "Proposer cette carte" → ouvre le formulaire en pré-sélectionnant la carte offerte
    container.querySelectorAll('[data-offer-card]').forEach((btn) => {
      btn.addEventListener('click', () => {
        openTradeForm(user, { preselectedOfferedCard: parseInt(btn.dataset.offerCard) });
      });
    });

  } catch (err) {
    container.querySelector('#collection-content').innerHTML = `
      <div class="empty-state"><p>Erreur : ${escapeHTML(err.message)}</p></div>`;
  }
}

// ── Déconnexion ──────────────────────────────────────────────────────────────
function setupLogout() {
  document.getElementById('btn-logout').addEventListener('click', async () => {
    await api.logout().catch(() => {});
    currentUser = null;
    document.getElementById('app').classList.add('hidden');
    document.getElementById('nav-trades-badge')?.remove();
    window.location.hash = '#catalog';
    window.removeEventListener('hashchange', route);
    showAuth();
  });
}

function setupNavHighlight() {
  document.querySelectorAll('.nav-link').forEach((link) => {
    link.addEventListener('click', () => {
      document.querySelectorAll('.nav-link').forEach((l) => l.classList.remove('active'));
      link.classList.add('active');
    });
  });
}

function escapeHTML(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

init();
