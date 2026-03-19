import { api } from './api.js';
import { renderNegotiationThread } from './negotiation.js';

let _currentUser = null;

export function initTrade(user) {
  _currentUser = user;
}

/**
 * Ouvre le formulaire de proposition dans le modal.
 */
export function openTradeForm(currentUser, { preselectedRequestedCard, recipientId } = {}) {
  _currentUser = currentUser;
  openModal(async () => {
    const content = document.getElementById('modal-content');
    content.innerHTML = '<div class="loading-state">Chargement…</div>';

    try {
      const [{ cards: myCards }, { cards: allCards }] = await Promise.all([
        api.getCards({ ownerId: currentUser.id }),
        api.getCards(),
      ]);

      const otherCards = allCards.filter((c) => c.ownerId !== currentUser.id);

      // Regrouper les cartes des autres par propriétaire
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
                const user = otherCards.find((c) => c.ownerId === ownerId)?.owner;
                return `<option value="${ownerId}" ${ownerId === initialRecipient ? 'selected' : ''}>
                  ${user?.avatar || '👤'} ${user?.name || 'Utilisateur ' + ownerId}
                </option>`;
              }).join('')}
            </select>
          </div>

          <div class="trade-form-panels">
            <div class="panel">
              <h3>Je propose (mes cartes)</h3>
              <div class="card-checkbox-list" id="offered-list">
                ${cardCheckboxList(myCards, 'offered', [])}
              </div>
            </div>
            <div class="panel">
              <h3>Je veux (ses cartes)</h3>
              <div class="card-checkbox-list" id="requested-list">
                ${cardCheckboxList(cardsOfRecipient, 'requested', preselectedRequestedCard ? [preselectedRequestedCard] : [])}
              </div>
            </div>
          </div>

          <div class="form-group">
            <label class="form-label">Message</label>
            <textarea class="form-textarea" id="trade-message" placeholder="Expliquez votre proposition…"></textarea>
          </div>

          <button type="submit" class="btn btn-primary btn-lg">Envoyer la proposition</button>
        </form>
      `;

      // Mise à jour des cartes du destinataire quand on change le select
      content.querySelector('#recipient-select').addEventListener('change', (e) => {
        const newRecipientId = parseInt(e.target.value);
        const newCards = otherCards.filter((c) => c.ownerId === newRecipientId);
        content.querySelector('#requested-list').innerHTML = cardCheckboxList(newCards, 'requested', []);
      });

      content.querySelector('#trade-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const form = e.target;
        const recipientIdVal = parseInt(form.querySelector('#recipient-select').value);
        const offeredCardIds = [...form.querySelectorAll('input[name="offered"]:checked')].map((i) => parseInt(i.value));
        const requestedCardIds = [...form.querySelectorAll('input[name="requested"]:checked')].map((i) => parseInt(i.value));
        const message = form.querySelector('#trade-message').value.trim();

        if (!offeredCardIds.length && !requestedCardIds.length) {
          alert('Sélectionnez au moins une carte à proposer ou à demander.');
          return;
        }
        if (!message) {
          alert('Ajoutez un message à votre proposition.');
          return;
        }

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
          alert('Erreur : ' + err.message);
        }
      });
    } catch (err) {
      content.innerHTML = `<p>Erreur : ${err.message}</p>`;
    }
  });
}

/**
 * Rendu de la liste des échanges de l'utilisateur.
 */
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
    <div id="trades-list"><div class="loading-state">Chargement…</div></div>
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
      listEl.innerHTML = `<div class="empty-state"><div class="empty-icon">🔄</div><p>Aucun échange ${role === 'sent' ? 'envoyé' : role === 'received' ? 'reçu' : ''}.</p></div>`;
      return;
    }

    listEl.innerHTML = `<div class="trade-list">${trades.map((t) => tradeItemHTML(t, currentUser)).join('')}</div>`;

    listEl.querySelectorAll('[data-trade-id]').forEach((item) => {
      item.addEventListener('click', () => {
        window.location.hash = `#trade/${item.dataset.tradeId}`;
      });
    });
  } catch (err) {
    listEl.innerHTML = `<div class="empty-state"><p>Erreur : ${err.message}</p></div>`;
  }
}

const STATUS_LABEL = {
  PENDING: 'En attente', ACCEPTED: 'Accepté', REFUSED: 'Refusé',
  COUNTERED: 'Contre-proposition', CANCELLED: 'Annulé',
};

function tradeItemHTML(trade, currentUser) {
  const isInitiator = trade.initiatorId === currentUser.id;
  const other = isInitiator ? trade.recipient : trade.initiator;
  const direction = isInitiator ? '→' : '←';
  const statusClass = 'badge-' + trade.status.toLowerCase();
  const date = new Date(trade.updatedAt).toLocaleDateString('fr-FR');

  return `
    <div class="trade-item" data-trade-id="${trade.id}">
      <div class="trade-item-info">
        <div class="trade-item-title">${direction} ${other.avatar || '👤'} ${other.name}</div>
        <div class="trade-item-meta">${date} · ${trade._count?.messages || 0} message(s)</div>
      </div>
      <div class="trade-item-actions">
        <span class="badge ${statusClass}">${STATUS_LABEL[trade.status] || trade.status}</span>
      </div>
    </div>
  `;
}

// --- Modal helpers ---

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

function cardCheckboxList(cards, name, preselected) {
  if (!cards.length) return '<p class="text-muted text-sm">Aucune carte disponible.</p>';
  return cards.map((c) => `
    <label class="card-checkbox-item">
      <input type="checkbox" name="${name}" value="${c.id}" ${preselected.includes(c.id) ? 'checked' : ''} />
      <span>${c.name}</span>
      <span class="text-muted text-sm">(${c.rarity})</span>
    </label>
  `).join('');
}
