import { api } from './api.js';
import { openTradeForm } from './trade.js';

const GAMES = [
  { value: '', label: 'Tous' },
  { value: 'POKEMON', label: '🔥 Pokémon' },
  { value: 'MAGIC',   label: '✨ Magic' },
  { value: 'YUGIOH',  label: '⚡ Yu-Gi-Oh!' },
  { value: 'DIGIMON', label: '🌙 Digimon' },
  { value: 'OTHER',   label: '🃏 Autre' },
];

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

let activeFilter = '';

export async function renderCatalog(container, currentUser) {
  container.innerHTML = `
    <div class="page-header">
      <h1 class="page-title">📖 Catalogue</h1>
    </div>
    <div class="filter-bar" id="filter-bar">
      ${GAMES.map((g) => `
        <button class="filter-btn ${g.value === activeFilter ? 'active' : ''}" data-game="${g.value}">
          ${g.label}
        </button>
      `).join('')}
    </div>
    <div id="card-grid-container"><div class="loading-state">Chargement des cartes…</div></div>
  `;

  const filterBar = container.querySelector('#filter-bar');
  filterBar.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-game]');
    if (!btn) return;
    activeFilter = btn.dataset.game;
    filterBar.querySelectorAll('.filter-btn').forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    loadCards(container, currentUser);
  });

  await loadCards(container, currentUser);
}

async function loadCards(container, currentUser) {
  const gridContainer = container.querySelector('#card-grid-container');
  gridContainer.innerHTML = '<div class="loading-state">Chargement…</div>';

  try {
    const filters = {};
    if (activeFilter) filters.game = activeFilter;

    const { cards } = await api.getCards(filters);

    if (!cards.length) {
      gridContainer.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">🃏</div>
          <p>Aucune carte dans cette catégorie.</p>
        </div>`;
      return;
    }

    gridContainer.innerHTML = `<div class="card-grid">${cards.map((c) => cardTileHTML(c, currentUser)).join('')}</div>`;

    gridContainer.querySelectorAll('[data-propose-card]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const cardId = parseInt(btn.dataset.proposeCard);
        const ownerId = parseInt(btn.dataset.ownerId);
        openTradeForm(currentUser, { preselectedRequestedCard: cardId, recipientId: ownerId });
      });
    });
  } catch (err) {
    gridContainer.innerHTML = `<div class="empty-state"><p>Erreur : ${err.message}</p></div>`;
  }
}

function cardTileHTML(card, currentUser) {
  const isOwn = card.ownerId === currentUser.id;
  const gameLabel = card.game.charAt(0) + card.game.slice(1).toLowerCase();
  const gameBadgeClass = 'badge-' + card.game.toLowerCase().replace('_', '-');

  return `
    <div class="card-tile">
      <div class="card-image-placeholder">${gameIcon(card.game)}</div>
      <div class="card-info">
        <div class="card-name" title="${card.name}">${card.name}</div>
        <div class="card-meta">
          <span class="badge ${gameBadgeClass}">${gameLabel}</span>
          <span class="badge ${RARITY_BADGE[card.rarity]}">${RARITY_LABEL[card.rarity]}</span>
        </div>
        <div class="card-owner text-muted text-sm">${card.owner.avatar || '👤'} ${card.owner.name}</div>
        <div class="card-actions mt-1">
          ${isOwn
            ? '<span class="text-sm text-muted">Ma carte</span>'
            : `<button class="btn btn-primary btn-sm" data-propose-card="${card.id}" data-owner-id="${card.ownerId}">Proposer un échange</button>`
          }
        </div>
      </div>
    </div>
  `;
}

function gameIcon(game) {
  const icons = { POKEMON: '🔥', MAGIC: '✨', YUGIOH: '⚡', DIGIMON: '🌙', OTHER: '🃏' };
  return icons[game] || '🃏';
}
