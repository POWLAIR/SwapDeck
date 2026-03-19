import { api } from './api.js';
import { renderAuthScreen, renderCurrentUser } from './auth.js';
import { renderCatalog } from './catalog.js';
import { renderTrades, openTradeForm } from './trade.js';
import { renderNegotiationThread } from './negotiation.js';

let currentUser = null;

async function init() {
  // Vérifie si une session existe
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

  // Routage
  window.addEventListener('hashchange', route);
  route();
}

function route() {
  const hash = window.location.hash || '#catalog';
  const main = document.getElementById('main-content');

  // Mettre à jour le lien actif
  document.querySelectorAll('.nav-link').forEach((l) => {
    l.classList.toggle('active', hash.startsWith('#' + l.dataset.page));
  });

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

async function renderCollection(container, user) {
  container.innerHTML = `
    <div class="page-header">
      <h1 class="page-title">🗂️ Ma collection</h1>
    </div>
    <div id="collection-content"><div class="loading-state">Chargement…</div></div>
  `;

  try {
    const { cards } = await api.getCards({ ownerId: user.id });

    if (!cards.length) {
      container.querySelector('#collection-content').innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">🗂️</div>
          <p>Vous n'avez aucune carte pour l'instant.<br>Contactez un administrateur pour en obtenir.</p>
        </div>`;
      return;
    }

    const RARITY_BADGE = { COMMON: 'badge-common', UNCOMMON: 'badge-uncommon', RARE: 'badge-rare', ULTRA_RARE: 'badge-ultra-rare', SECRET_RARE: 'badge-secret-rare' };
    const RARITY_LABEL = { COMMON: 'Commune', UNCOMMON: 'Peu commune', RARE: 'Rare', ULTRA_RARE: 'Ultra Rare', SECRET_RARE: 'Secrète' };
    const GAME_ICONS   = { POKEMON: '🔥', MAGIC: '✨', YUGIOH: '⚡', DIGIMON: '🌙', OTHER: '🃏' };

    container.querySelector('#collection-content').innerHTML = `
      <div class="card-grid">
        ${cards.map((c) => `
          <div class="card-tile">
            <div class="card-image-placeholder">${GAME_ICONS[c.game] || '🃏'}</div>
            <div class="card-info">
              <div class="card-name">${c.name}</div>
              <div class="card-meta">
                <span class="badge badge-${c.game.toLowerCase()}">${c.game}</span>
                <span class="badge ${RARITY_BADGE[c.rarity]}">${RARITY_LABEL[c.rarity]}</span>
              </div>
              <p class="text-muted text-sm mt-1">${c.description}</p>
            </div>
          </div>
        `).join('')}
      </div>`;
  } catch (err) {
    container.querySelector('#collection-content').innerHTML = `<div class="empty-state"><p>Erreur : ${err.message}</p></div>`;
  }
}

function setupLogout() {
  document.getElementById('btn-logout').addEventListener('click', async () => {
    await api.logout().catch(() => {});
    currentUser = null;
    document.getElementById('app').classList.add('hidden');
    window.location.hash = '#catalog';
    showAuth();
  });
}

function setupNavHighlight() {
  document.querySelectorAll('.nav-link').forEach((link) => {
    link.addEventListener('click', (e) => {
      document.querySelectorAll('.nav-link').forEach((l) => l.classList.remove('active'));
      link.classList.add('active');
    });
  });
}

init();
