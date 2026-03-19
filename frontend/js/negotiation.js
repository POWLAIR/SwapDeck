import { api } from './api.js';

/**
 * Affiche le fil de négociation complet d'une trade.
 */
export async function renderNegotiationThread(container, tradeId, currentUser) {
  container.innerHTML = `
    <div class="page-header">
      <button id="btn-back" class="btn btn-ghost btn-sm">← Retour</button>
      <h1 class="page-title">Négociation #${tradeId}</h1>
    </div>
    <div id="thread-container"><div class="loading-state">Chargement…</div></div>
  `;

  container.querySelector('#btn-back').addEventListener('click', () => {
    window.location.hash = '#trades';
  });

  await loadThread(container, tradeId, currentUser);
}

async function loadThread(container, tradeId, currentUser) {
  const threadContainer = container.querySelector('#thread-container');

  try {
    const [{ trade }, { messages }] = await Promise.all([
      api.getTrade(tradeId),
      api.getMessages(tradeId),
    ]);

    const isRecipient  = trade.recipientId  === currentUser.id;
    const isInitiator  = trade.initiatorId  === currentUser.id;
    const canAct       = isRecipient && trade.status === 'PENDING';

    const offeredCards   = trade.tradeCards.filter((tc) => tc.direction === 'OFFERED');
    const requestedCards = trade.tradeCards.filter((tc) => tc.direction === 'REQUESTED');

    threadContainer.innerHTML = `
      <div class="thread-header">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:.75rem">
          <div>
            <strong>${trade.initiator.avatar} ${trade.initiator.name}</strong>
            <span class="text-muted"> → </span>
            <strong>${trade.recipient.avatar} ${trade.recipient.name}</strong>
          </div>
          <span class="badge badge-${trade.status.toLowerCase()}">${statusLabel(trade.status)}</span>
        </div>

        <div class="thread-cards">
          <div class="thread-cards-side">
            <h4>Proposé par ${trade.initiator.name}</h4>
            ${offeredCards.map((tc) => `
              <div class="thread-card-mini">🃏 ${tc.card.name} <span class="text-muted text-sm">(${tc.card.game})</span></div>
            `).join('') || '<p class="text-muted text-sm">Rien</p>'}
          </div>
          <div class="thread-separator">⇄</div>
          <div class="thread-cards-side">
            <h4>Demandé par ${trade.initiator.name}</h4>
            ${requestedCards.map((tc) => `
              <div class="thread-card-mini">🃏 ${tc.card.name} <span class="text-muted text-sm">(${tc.card.game})</span></div>
            `).join('') || '<p class="text-muted text-sm">Rien</p>'}
          </div>
        </div>
      </div>

      <div class="thread-messages" id="messages-list">
        ${messages.map((m) => messageBubbleHTML(m, currentUser)).join('')}
      </div>

      ${canAct ? actionButtonsHTML() : ''}

      ${trade.status === 'PENDING' ? messageFormHTML() : ''}

      ${trade.counters?.length ? `<div class="mt-3"><a href="#trade/${trade.counters[0].id}" class="btn btn-ghost btn-sm">Voir la contre-proposition →</a></div>` : ''}
      ${trade.parentTradeId ? `<div class="mt-2"><a href="#trade/${trade.parentTradeId}" class="btn btn-ghost btn-sm">← Proposition originale</a></div>` : ''}
    `;

    // Actions
    if (canAct) {
      threadContainer.querySelector('#btn-accept')?.addEventListener('click', async () => {
        if (!confirm('Accepter cet échange ?')) return;
        try {
          await api.acceptTrade(tradeId);
          await loadThread(container, tradeId, currentUser);
        } catch (err) { alert(err.message); }
      });

      threadContainer.querySelector('#btn-refuse')?.addEventListener('click', async () => {
        if (!confirm('Refuser cet échange ?')) return;
        try {
          await api.refuseTrade(tradeId);
          await loadThread(container, tradeId, currentUser);
        } catch (err) { alert(err.message); }
      });

      threadContainer.querySelector('#btn-counter')?.addEventListener('click', () => {
        renderCounterForm(threadContainer, tradeId, currentUser, trade);
      });
    }

    // Message libre
    const msgForm = threadContainer.querySelector('#message-form');
    if (msgForm) {
      msgForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const input = msgForm.querySelector('textarea');
        const body = input.value.trim();
        if (!body) return;
        try {
          await api.addMessage(tradeId, body);
          input.value = '';
          await loadThread(container, tradeId, currentUser);
        } catch (err) { alert(err.message); }
      });
    }

  } catch (err) {
    threadContainer.innerHTML = `<div class="empty-state"><p>Erreur : ${err.message}</p></div>`;
  }
}

function renderCounterForm(container, tradeId, currentUser, originalTrade) {
  // Récupérer les cartes disponibles pour la contre-proposition
  const counterSection = document.createElement('div');
  counterSection.className = 'mt-3';
  counterSection.innerHTML = `
    <div class="panel">
      <h3>Contre-proposition</h3>
      <p class="text-muted text-sm mb-2">Chargement des cartes…</p>
    </div>
  `;
  container.querySelector('#thread-container > div:last-child')?.after(counterSection);

  api.getCards({ ownerId: currentUser.id }).then(({ cards: myCards }) => {
    api.getCards({ ownerId: originalTrade.initiatorId }).then(({ cards: theirCards }) => {
      counterSection.innerHTML = `
        <div class="panel">
          <h3>Contre-proposition</h3>
          <form id="counter-form" class="trade-form">
            <div class="trade-form-panels">
              <div>
                <label class="form-label">Je propose (mes cartes)</label>
                <div class="card-checkbox-list">
                  ${myCards.map((c) => `
                    <label class="card-checkbox-item">
                      <input type="checkbox" name="offered" value="${c.id}" />
                      <span>${c.name}</span>
                    </label>
                  `).join('')}
                </div>
              </div>
              <div>
                <label class="form-label">Je veux (ses cartes)</label>
                <div class="card-checkbox-list">
                  ${theirCards.map((c) => `
                    <label class="card-checkbox-item">
                      <input type="checkbox" name="requested" value="${c.id}" />
                      <span>${c.name}</span>
                    </label>
                  `).join('')}
                </div>
              </div>
            </div>
            <div class="form-group">
              <label class="form-label">Message</label>
              <textarea class="form-textarea" name="message" placeholder="Expliquez votre contre-proposition…"></textarea>
            </div>
            <div style="display:flex;gap:.5rem">
              <button type="submit" class="btn btn-warning">Envoyer la contre-proposition</button>
              <button type="button" id="btn-cancel-counter" class="btn btn-ghost">Annuler</button>
            </div>
          </form>
        </div>
      `;

      counterSection.querySelector('#btn-cancel-counter').addEventListener('click', () => {
        counterSection.remove();
      });

      counterSection.querySelector('#counter-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const form = e.target;
        const offeredCardIds   = [...form.querySelectorAll('input[name="offered"]:checked')].map((i) => parseInt(i.value));
        const requestedCardIds = [...form.querySelectorAll('input[name="requested"]:checked')].map((i) => parseInt(i.value));
        const message = form.querySelector('[name="message"]').value.trim();

        if (!message) { alert('Message requis.'); return; }

        try {
          const { trade: newTrade } = await api.counterTrade(tradeId, { offeredCardIds, requestedCardIds, message });
          window.location.hash = `#trade/${newTrade.id}`;
        } catch (err) { alert(err.message); }
      });
    });
  });
}

function messageBubbleHTML(msg, currentUser) {
  const isMine   = msg.authorId === currentUser.id;
  const isSystem = ['ACCEPT', 'REFUSE', 'COUNTER'].includes(msg.action);
  const cls      = isSystem ? 'system' : isMine ? 'mine' : 'theirs';
  const time     = new Date(msg.createdAt).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

  return `
    <div class="message-bubble ${cls}">
      ${!isMine && !isSystem ? `<div class="message-author">${msg.author.avatar || '👤'} ${msg.author.name}</div>` : ''}
      <div>${msg.body}</div>
      <div class="message-time">${time}</div>
    </div>
  `;
}

function actionButtonsHTML() {
  return `
    <div class="thread-actions mt-2">
      <button id="btn-accept"  class="btn btn-success">✓ Accepter</button>
      <button id="btn-refuse"  class="btn btn-danger">✗ Refuser</button>
      <button id="btn-counter" class="btn btn-warning">↩ Contre-proposer</button>
    </div>
  `;
}

function messageFormHTML() {
  return `
    <form id="message-form" style="display:flex;gap:.5rem;margin-top:1rem">
      <textarea class="form-textarea" style="flex:1;min-height:60px" placeholder="Ajouter un commentaire…"></textarea>
      <button type="submit" class="btn btn-ghost">Envoyer</button>
    </form>
  `;
}

function statusLabel(status) {
  const labels = {
    PENDING: 'En attente', ACCEPTED: 'Accepté', REFUSED: 'Refusé',
    COUNTERED: 'Contre-proposition', CANCELLED: 'Annulé',
  };
  return labels[status] || status;
}
