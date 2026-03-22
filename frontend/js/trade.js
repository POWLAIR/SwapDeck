import { api } from './api.js';
import { renderNegotiationThread } from './negotiation.js';

const RARITY_BADGE = {
  COMMON: 'badge-common',
  UNCOMMON: 'badge-uncommon',
  RARE: 'badge-rare',
  ULTRA_RARE: 'badge-ultra-rare',
  SECRET_RARE: 'badge-secret-rare',
};

const RARITY_LABEL = {
  COMMON: 'Commune',
  UNCOMMON: 'Peu commune',
  RARE: 'Rare',
  ULTRA_RARE: 'Ultra Rare',
  SECRET_RARE: 'Secrète',
};

const STATUS_LABEL = {
  PENDING: 'En attente',
  ACCEPTED: 'Accepté',
  REFUSED: 'Refusé',
  COUNTERED: 'Contre-proposition',
  CANCELLED: 'Annulé',
};

let _currentUser = null;

export function initTrade(user) {
  _currentUser = user;
}

// ── Formulaire de proposition ─────────────────────────────────────────────────
/**
 * Ouvre le modal de proposition d'échange.
 *
 * @param {object} currentUser
 * @param {object} [opts]
 * @param {number}  [opts.preselectedRequestedCard] - ID d'une carte à demander (depuis le catalogue)
 * @param {number}  [opts.preselectedOfferedCard]   - ID d'une carte à offrir (depuis la collection)
 * @param {number}  [opts.recipientId]              - ID du destinataire présélectionné
 */
export function openTradeForm(currentUser, {
  preselectedRequestedCard,
  preselectedOfferedCard,
  recipientId,
} = {}) {
  _currentUser = currentUser;

  openModal(async () => {
    const content = document.getElementById('modal-content');
    content.innerHTML = '<div class="loading-state">Chargement…</div>';

    try {
      const { user: freshUser } = await api.me();
      currentUser = freshUser;

      const [{ cards: myCards }, { cards: allCards }] = await Promise.all([
        api.getCards({ ownerId: currentUser.id }),
        api.getCards(),
      ]);

      const otherCards = allCards.filter((c) => c.ownerId !== currentUser.id);
      const otherOwners = [...new Set(otherCards.map((c) => c.ownerId))];
      const initialRecipient = recipientId || (otherOwners.length ? otherOwners[0] : null);
      const cardsOfRecipient = otherCards.filter((c) => c.ownerId === initialRecipient);

      content.innerHTML = `
        <h2 class="mb-2">Proposer un échange</h2>
        <form id="trade-form" class="trade-form">
          <div class="form-group">
            <label class="form-label">Destinataire</label>
            <select class="form-select" id="recipient-select">
              ${otherOwners.map((ownerId) => {
        const u = otherCards.find((c) => c.ownerId === ownerId)?.owner;
        return `<option value="${ownerId}" ${ownerId === initialRecipient ? 'selected' : ''}>
                  ${u?.avatar || '👤'} ${u?.name || 'Utilisateur ' + ownerId}
                </option>`;
      }).join('')}
            </select>
          </div>

          <div class="trade-form-panels">
            <div class="panel">
              <div class="panel-header">
                <h3>Je propose (mes cartes)</h3>
                <span class="panel-count" id="offered-count">0 sélectionné</span>
              </div>
              <div class="card-checkbox-list" id="offered-list">
                ${cardCheckboxList(myCards, 'offered', preselectedOfferedCard ? [preselectedOfferedCard] : [])}
              </div>
            </div>
            <div class="panel">
              <div class="panel-header">
                <h3>Je veux (ses cartes)</h3>
                <span class="panel-count" id="requested-count">0 sélectionné</span>
              </div>
              <div class="card-checkbox-list" id="requested-list">
                ${cardCheckboxList(cardsOfRecipient, 'requested', preselectedRequestedCard ? [preselectedRequestedCard] : [])}
              </div>
            </div>
          </div>

          <div class="form-group">
            <label class="form-label">Message <span style="color:var(--color-accent)">*</span></label>
            <textarea
              class="form-textarea"
              id="trade-message"
              placeholder="Expliquez votre proposition, la valeur de vos cartes, vos conditions…"
              rows="3"
            ></textarea>
          </div>

          <div id="form-error" class="form-error hidden"></div>

          <button type="submit" class="btn btn-primary btn-lg">Envoyer la proposition</button>
        </form>
      `;

      // Initialise les compteurs au rendu
      updatePanelCount(content, 'offered', preselectedOfferedCard ? 1 : 0);
      updatePanelCount(content, 'requested', preselectedRequestedCard ? 1 : 0);

      // Sélection visuelle + compteur live sur les checkboxes
      bindCheckboxSelection(content);

      // Mise à jour des cartes du destinataire quand on change le select
      content.querySelector('#recipient-select').addEventListener('change', (e) => {
        const newRecipientId = parseInt(e.target.value);
        const newCards = otherCards.filter((c) => c.ownerId === newRecipientId);
        content.querySelector('#requested-list').innerHTML = cardCheckboxList(newCards, 'requested', []);
        updatePanelCount(content, 'requested', 0);
        bindCheckboxSelection(content);
      });

      // Soumission
      content.querySelector('#trade-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const form = e.target;
        const errorEl = form.querySelector('#form-error');

        const recipientIdVal = parseInt(form.querySelector('#recipient-select').value);
        const offeredCardIds = [...form.querySelectorAll('input[name="offered"]:checked')].map((i) => parseInt(i.value));
        const requestedCardIds = [...form.querySelectorAll('input[name="requested"]:checked')].map((i) => parseInt(i.value));
        const message = form.querySelector('#trade-message').value.trim();

        if (!offeredCardIds.length && !requestedCardIds.length) {
          showFormError(errorEl, 'Sélectionnez au moins une carte à proposer ou à demander.');
          return;
        }
        if (!message) {
          showFormError(errorEl, 'Ajoutez un message pour expliquer votre proposition.');
          return;
        }

        hideFormError(errorEl);
        const submitBtn = form.querySelector('button[type="submit"]');
        submitBtn.disabled = true;
        submitBtn.textContent = 'Envoi en cours…';

        try {
          const { trade } = await api.createTrade({
            recipientId: recipientIdVal,
            offeredCardIds,
            requestedCardIds,
            message,
          });
          closeModal();
          window.location.hash = `#trade/${trade.id}`;
        } catch (err) {
          const msg = err.message === 'UNAUTHORIZED'
            ? 'Vous ne possédez pas toutes les cartes sélectionnées. Rechargez la page et reconnectez-vous.'
            : err.message === 'Non authentifié'
              ? 'Session expirée. Veuillez vous reconnecter.'
              : 'Erreur : ' + err.message;
          showFormError(errorEl, msg);
          submitBtn.disabled = false;
          submitBtn.textContent = 'Envoyer la proposition';
        }
      });

    } catch (err) {
      content.innerHTML = `<p class="text-muted">Erreur : ${escapeHTML(err.message)}</p>`;
    }
  });
}

// ── Liste des échanges ────────────────────────────────────────────────────────
export async function renderTrades(container, currentUser) {
  container.innerHTML = `
    <div class="page-header">
      <h1 class="page-title">🔄 Mes échanges</h1>
      <button id="btn-new-trade" class="btn btn-primary">+ Nouveau</button>
    </div>
    <div class="filter-bar">
      <button class="filter-btn active" data-role="all">Tous</button>
      <button class="filter-btn" data-role="sent">Envoyés</button>
      <button class="filter-btn" data-role="received">Reçus</button>
    </div>
    <div id="trades-list">
      <div class="loading-state">Chargement…</div>
    </div>
  `;

  container.querySelector('#btn-new-trade').addEventListener('click', () => {
    openTradeForm(currentUser);
  });

  const filterBar = container.querySelector('.filter-bar');
  filterBar.addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-role]');
    if (!btn) return;
    filterBar.querySelectorAll('.filter-btn').forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    await loadTrades(container, currentUser, btn.dataset.role);
  });

  await loadTrades(container, currentUser, 'all');
}

async function loadTrades(container, currentUser, role) {
  const listEl = container.querySelector('#trades-list');
  listEl.innerHTML = '<div class="loading-state">Chargement…</div>';

  try {
    const { trades } = await api.getTrades({ role });

    if (!trades.length) {
      const label = role === 'sent' ? 'envoyé' : role === 'received' ? 'reçu' : '';
      listEl.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">🔄</div>
          <p>Aucun échange ${label}.<br>
             <a href="#catalog" class="text-muted" style="text-decoration:underline">
               Parcourez le catalogue
             </a> pour faire une proposition.</p>
        </div>`;
      return;
    }

    listEl.innerHTML = `<div class="trade-list">${trades.map((t) => tradeItemHTML(t, currentUser)).join('')}</div>`;

    listEl.querySelectorAll('[data-trade-id]').forEach((item) => {
      item.addEventListener('click', () => {
        window.location.hash = `#trade/${item.dataset.tradeId}`;
      });
    });
  } catch (err) {
    listEl.innerHTML = `<div class="empty-state"><p>Erreur : ${escapeHTML(err.message)}</p></div>`;
  }
}

function tradeItemHTML(trade, currentUser) {
  const isInitiator = trade.initiatorId === currentUser.id;
  const other = isInitiator ? trade.recipient : trade.initiator;
  const dirLabel = isInitiator ? 'Proposé à' : 'Reçu de';
  const dirArrow = isInitiator ? '→' : '←';
  const statusClass = 'badge-' + trade.status.toLowerCase();
  const date = relativeDate(new Date(trade.updatedAt));
  const cardCount = trade._count?.tradeCards || 0;
  const msgCount = trade._count?.messages || 0;
  // Indicateur "non lu" : trade reçu en attente de réponse
  const needsAction = !isInitiator && trade.status === 'PENDING';

  return `
    <div class="trade-item ${needsAction ? 'trade-item--action-needed' : ''}" data-trade-id="${trade.id}">
      <div class="trade-item-left">
        ${needsAction ? '<span class="unread-dot" title="Nécessite votre réponse"></span>' : ''}
        <div class="trade-item-avatar">${other.avatar || '👤'}</div>
      </div>
      <div class="trade-item-info">
        <div class="trade-item-title">
          ${dirLabel} <strong>${escapeHTML(other.name)}</strong>
          <span class="text-muted" style="font-weight:400"> ${dirArrow}</span>
        </div>
        <div class="trade-item-meta">
          ${date}
          · ${cardCount} carte${cardCount > 1 ? 's' : ''}
          · ${msgCount} message${msgCount > 1 ? 's' : ''}
        </div>
      </div>
      <div class="trade-item-actions">
        <span class="badge ${statusClass}">${STATUS_LABEL[trade.status] || trade.status}</span>
      </div>
    </div>
  `;
}

// ── Helpers checkboxes ────────────────────────────────────────────────────────
function cardCheckboxList(cards, name, preselected) {
  if (!cards.length) return '<p class="text-muted text-sm" style="padding:.5rem">Aucune carte disponible.</p>';

  return cards.map((c) => {
    const checked = preselected.includes(c.id);
    const gameIcon = { POKEMON: '🔥', MAGIC: '✨', YUGIOH: '⚡', DIGIMON: '🌙', OTHER: '🃏' }[c.game] || '🃏';
    return `
      <label class="card-checkbox-item ${checked ? 'selected' : ''}">
        <input type="checkbox" name="${name}" value="${c.id}" ${checked ? 'checked' : ''} />
        <span class="card-checkbox-icon">${gameIcon}</span>
        <span class="card-checkbox-name">${escapeHTML(c.name)}</span>
        <span class="badge ${RARITY_BADGE[c.rarity]} badge-xs">${RARITY_LABEL[c.rarity]}</span>
      </label>
    `;
  }).join('');
}

function bindCheckboxSelection(content) {
  content.querySelectorAll('.card-checkbox-item input[type="checkbox"]').forEach((cb) => {
    cb.addEventListener('change', () => {
      cb.closest('.card-checkbox-item').classList.toggle('selected', cb.checked);

      // Met à jour le compteur du bon panneau
      const name = cb.name; // 'offered' | 'requested'
      const count = content.querySelectorAll(`input[name="${name}"]:checked`).length;
      updatePanelCount(content, name, count);
    });
  });
}

function updatePanelCount(content, name, count) {
  const el = content.querySelector(`#${name}-count`);
  if (el) el.textContent = `${count} sélectionné${count > 1 ? 's' : ''}`;
}

function showFormError(el, msg) {
  el.textContent = msg;
  el.classList.remove('hidden');
}

function hideFormError(el) {
  el.textContent = '';
  el.classList.add('hidden');
}

// ── Dates relatives ───────────────────────────────────────────────────────────
export function relativeDate(date) {
  const diff = Date.now() - date.getTime();
  const minutes = Math.floor(diff / 60_000);
  const hours = Math.floor(diff / 3_600_000);
  const days = Math.floor(diff / 86_400_000);

  if (minutes < 1) return "à l'instant";
  if (minutes < 60) return `il y a ${minutes} min`;
  if (hours < 24) return `il y a ${hours} h`;
  if (days < 7) return `il y a ${days} jour${days > 1 ? 's' : ''}`;
  return date.toLocaleDateString('fr-FR');
}

// ── Modal helpers ─────────────────────────────────────────────────────────────
function openModal(renderFn) {
  const overlay = document.getElementById('modal-overlay');
  overlay.classList.remove('hidden');
  renderFn();

  document.getElementById('modal-close').onclick = closeModal;
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closeModal();
  }, { once: true });
}

function closeModal() {
  document.getElementById('modal-overlay').classList.add('hidden');
  document.getElementById('modal-content').innerHTML = '';
}

function escapeHTML(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
