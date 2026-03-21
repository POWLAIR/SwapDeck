import { api } from './api.js';
import { openTradeForm } from './trade.js';
import { injectCardImages } from './card-images.js';

const GAMES = [
  { value: '',        label: 'Tous' },
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

// État du filtre actif et de la recherche (persisté entre navigations)
let activeFilter = '';
let activeSearch = '';

export async function renderCatalog(container, currentUser) {
  container.innerHTML = `
    <div class="page-header">
      <h1 class="page-title">📖 Catalogue</h1>
    </div>

    <div class="catalog-search">
      <input
        type="search"
        id="catalog-search-input"
        class="form-input"
        placeholder="🔍 Rechercher par nom ou description…"
        value="${escapeHTML(activeSearch)}"
        autocomplete="off"
      />
    </div>

    <div class="filter-bar" id="filter-bar">
      ${GAMES.map((g) => `
        <button class="filter-btn ${g.value === activeFilter ? 'active' : ''}" data-game="${g.value}">
          ${g.label}
        </button>
      `).join('')}
    </div>

    <div id="card-grid-container">
      <div class="loading-state">Chargement des cartes…</div>
    </div>
  `;

  // ── Recherche avec debounce ──────────────────────────────────────────────
  const searchInput = container.querySelector('#catalog-search-input');
  let searchTimer;
  searchInput.addEventListener('input', (e) => {
    activeSearch = e.target.value;
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => loadCards(container, currentUser), 220);
  });

  // ── Filtre par jeu ───────────────────────────────────────────────────────
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
    // Filtre jeu côté serveur, filtre texte côté client
    const filters = {};
    if (activeFilter) filters.game = activeFilter;

    const { cards: allCards } = await api.getCards(filters);

    const cards = activeSearch.trim()
      ? allCards.filter((c) => {
          const q = activeSearch.toLowerCase();
          return (
            c.name.toLowerCase().includes(q) ||
            c.description.toLowerCase().includes(q) ||
            c.owner.name.toLowerCase().includes(q)
          );
        })
      : allCards;

    if (!cards.length) {
      const msg = activeSearch
        ? `Aucune carte ne correspond à « ${escapeHTML(activeSearch)} ».`
        : 'Aucune carte dans cette catégorie.';
      gridContainer.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">🃏</div>
          <p>${msg}</p>
        </div>`;
      return;
    }

    gridContainer.innerHTML = `
      <div class="catalog-count text-muted text-sm mb-1">
        ${cards.length} carte${cards.length > 1 ? 's' : ''}
      </div>
      <div class="card-grid">
        ${cards.map((c) => cardTileHTML(c, currentUser)).join('')}
      </div>`;

    // Injection progressive des vraies images (sans bloquer le rendu)
    injectCardImages(gridContainer);

    // Liaison des boutons "Proposer un échange"
    gridContainer.querySelectorAll('[data-propose-card]').forEach((btn) => {
      btn.addEventListener('click', () => {
        openTradeForm(currentUser, {
          preselectedRequestedCard: parseInt(btn.dataset.proposeCard),
          recipientId:              parseInt(btn.dataset.ownerId),
        });
      });
    });

  } catch (err) {
    gridContainer.innerHTML = `
      <div class="empty-state">
        <p>Erreur lors du chargement : ${escapeHTML(err.message)}</p>
      </div>`;
  }
}

function cardTileHTML(card, currentUser) {
  const isOwn         = card.ownerId === currentUser.id;
  const gameLabel     = card.game.charAt(0) + card.game.slice(1).toLowerCase().replace('_', ' ');
  const gameBadgeClass = 'badge-' + card.game.toLowerCase().replace('_', '-');

  return `
    <div class="card-tile">
      <div class="card-image-placeholder card-image-placeholder--${card.game.toLowerCase()}"
           data-card-game="${card.game}"
           data-card-name="${escapeHTML(card.name)}">
        ${gameIcon(card.game)}
      </div>
      <div class="card-info">
        <div class="card-name" title="${escapeHTML(card.name)}">${escapeHTML(card.name)}</div>
        <div class="card-meta">
          <span class="badge ${gameBadgeClass}">${gameLabel}</span>
          <span class="badge ${RARITY_BADGE[card.rarity]}">${RARITY_LABEL[card.rarity]}</span>
        </div>
        <p class="card-description">${escapeHTML(card.description)}</p>
        <div class="card-owner text-muted text-sm">${card.owner.avatar || '👤'} ${escapeHTML(card.owner.name)}</div>
        <div class="card-actions mt-1">
          ${isOwn
            ? '<span class="text-sm text-muted card-own-label">Ma carte</span>'
            : `<button
                class="btn btn-primary btn-sm"
                data-propose-card="${card.id}"
                data-owner-id="${card.ownerId}">
                Proposer un échange
              </button>`
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

function escapeHTML(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
