import { api } from './api.js';
import { relativeDate } from './trade.js';

/**
 * Affiche le fil de négociation complet d'une trade.
 */
export async function renderNegotiationThread(container, tradeId, currentUser) {
  container.innerHTML = `
    <div class="page-header">
      <button id="btn-back" class="btn btn-ghost btn-sm">← Retour</button>
      <h1 class="page-title" id="thread-title">Négociation #${tradeId}</h1>
    </div>
    <div id="thread-container">
      <div class="loading-state">Chargement…</div>
    </div>
  `;

  container.querySelector('#btn-back').addEventListener('click', () => {
    window.location.hash = '#trades';
  });

  await loadThread(container, tradeId, currentUser);
}

async function loadThread(container, tradeId, currentUser) {
  const threadContainer = container.querySelector('#thread-container');

  try {
    const { user: freshUser } = await api.me();
    currentUser = freshUser;

    const [{ trade }, { messages }] = await Promise.all([
      api.getTrade(tradeId),
      api.getMessages(tradeId),
    ]);

    const isRecipient = trade.recipientId === currentUser.id;
    const isInitiator = trade.initiatorId === currentUser.id;
    const canAct = isRecipient && trade.status === 'PENDING';
    const canCancel = isInitiator && trade.status === 'PENDING';
    const canMessage = (isInitiator || isRecipient) && ['PENDING', 'COUNTERED'].includes(trade.status);

    // Met à jour le titre avec les noms des parties
    const titleEl = container.querySelector('#thread-title');
    if (titleEl) titleEl.textContent = `#${tradeId} — ${trade.initiator.name} ↔ ${trade.recipient.name}`;

    const offeredCards = trade.tradeCards.filter((tc) => tc.direction === 'OFFERED');
    const requestedCards = trade.tradeCards.filter((tc) => tc.direction === 'REQUESTED');

    // Navigation dans la chaîne de contre-propositions
    const chainNavHTML = buildChainNav(trade);

    threadContainer.innerHTML = `
      ${chainNavHTML}

      <div class="thread-header">
        <div class="thread-header-top">
          <div class="thread-participants">
            <strong>${trade.initiator.avatar} ${escapeHTML(trade.initiator.name)}</strong>
            <span class="text-muted"> → </span>
            <strong>${trade.recipient.avatar} ${escapeHTML(trade.recipient.name)}</strong>
          </div>
          <span class="badge badge-${trade.status.toLowerCase()}">${statusLabel(trade.status)}</span>
        </div>

        <div class="thread-cards">
          <div class="thread-cards-side">
            <h4>Proposé par ${escapeHTML(trade.initiator.name)}</h4>
            ${offeredCards.length
        ? offeredCards.map((tc) => threadCardMini(tc)).join('')
        : '<p class="text-muted text-sm">Rien à offrir</p>'}
          </div>
          <div class="thread-separator">⇄</div>
          <div class="thread-cards-side">
            <h4>Demandé par ${escapeHTML(trade.initiator.name)}</h4>
            ${requestedCards.length
        ? requestedCards.map((tc) => threadCardMini(tc)).join('')
        : '<p class="text-muted text-sm">Rien à demander</p>'}
          </div>
        </div>
      </div>

      <div class="thread-messages" id="messages-list">
        ${messages.map((m) => messageBubbleHTML(m, currentUser)).join('')}
      </div>

      ${canAct ? actionButtonsHTML() : ''}
      ${canCancel ? cancelButtonHTML() : ''}
      ${canMessage ? messageFormHTML() : ''}
    `;

    // ── Auto-scroll vers le dernier message ──────────────────────────────────
    const msgList = threadContainer.querySelector('#messages-list');
    if (msgList && msgList.children.length > 0) {
      setTimeout(() => {
        msgList.lastElementChild?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }, 50);
    }

    // ── Bouton Accepter ───────────────────────────────────────────────────────
    if (canAct) {
      threadContainer.querySelector('#btn-accept')?.addEventListener('click', async () => {
        const btn = threadContainer.querySelector('#btn-accept');
        await withLoading(btn, '⌛ Acceptation…', async () => {
          await api.acceptTrade(tradeId);
          await loadThread(container, tradeId, currentUser);
        });
      });

      // ── Bouton Refuser ──────────────────────────────────────────────────────
      threadContainer.querySelector('#btn-refuse')?.addEventListener('click', async () => {
        const btn = threadContainer.querySelector('#btn-refuse');
        await withLoading(btn, '⌛ Refus…', async () => {
          await api.refuseTrade(tradeId);
          await loadThread(container, tradeId, currentUser);
        });
      });

      // ── Bouton Contre-proposer ──────────────────────────────────────────────
      threadContainer.querySelector('#btn-counter')?.addEventListener('click', () => {
        renderCounterForm(threadContainer, tradeId, currentUser, trade);
      });
    }

    // ── Bouton Annuler (initiateur) ───────────────────────────────────────────
    if (canCancel) {
      threadContainer.querySelector('#btn-cancel-trade')?.addEventListener('click', async () => {
        const btn = threadContainer.querySelector('#btn-cancel-trade');
        await withLoading(btn, '⌛ Annulation…', async () => {
          await api.cancelTrade(tradeId);
          await loadThread(container, tradeId, currentUser);
        });
      });
    }

    // ── Formulaire message libre ──────────────────────────────────────────────
    const msgForm = threadContainer.querySelector('#message-form');
    if (msgForm) {
      msgForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const input = msgForm.querySelector('textarea');
        const sendBtn = msgForm.querySelector('button[type="submit"]');
        const body = input.value.trim();
        if (!body) return;

        await withLoading(sendBtn, '…', async () => {
          await api.addMessage(tradeId, body);
          input.value = '';
          await loadThread(container, tradeId, currentUser);
        }, { restore: false }); // Le thread se recharge, le bouton n'a pas besoin d'être restauré
      });
    }

  } catch (err) {
    threadContainer.innerHTML = `
      <div class="empty-state">
        <p>Impossible de charger la négociation.<br>
           <span class="text-sm">${escapeHTML(err.message)}</span>
        </p>
      </div>`;
  }
}

// ── Formulaire de contre-proposition ─────────────────────────────────────────
function renderCounterForm(container, tradeId, currentUser, originalTrade) {
  // Masque les boutons d'action pour éviter les doubles clics
  container.querySelector('.thread-actions')?.remove();

  const counterSection = document.createElement('div');
  counterSection.className = 'counter-form-section mt-3';
  counterSection.innerHTML = `
    <div class="panel">
      <h3 style="margin-bottom:.75rem">↩ Contre-proposition</h3>
      <p class="text-muted text-sm mb-2">Chargement des cartes…</p>
    </div>
  `;
  container.appendChild(counterSection);

  Promise.all([
    api.getCards({ ownerId: currentUser.id }),
    api.getCards({ ownerId: originalTrade.initiatorId }),
  ]).then(([{ cards: myCards }, { cards: theirCards }]) => {
    const RARITY_BADGE = { COMMON: 'badge-common', UNCOMMON: 'badge-uncommon', RARE: 'badge-rare', ULTRA_RARE: 'badge-ultra-rare', SECRET_RARE: 'badge-secret-rare' };
    const RARITY_LABEL = { COMMON: 'Commune', UNCOMMON: 'Peu commune', RARE: 'Rare', ULTRA_RARE: 'Ultra Rare', SECRET_RARE: 'Secrète' };
    const gameIcon = (g) => ({ POKEMON: '🔥', MAGIC: '✨', YUGIOH: '⚡', DIGIMON: '🌙', OTHER: '🃏' }[g] || '🃏');

    const checkboxList = (cards, name) => cards.length
      ? cards.map((c) => `
          <label class="card-checkbox-item">
            <input type="checkbox" name="${name}" value="${c.id}" />
            <span class="card-checkbox-icon">${gameIcon(c.game)}</span>
            <span class="card-checkbox-name">${escapeHTML(c.name)}</span>
            <span class="badge ${RARITY_BADGE[c.rarity]} badge-xs">${RARITY_LABEL[c.rarity]}</span>
          </label>`).join('')
      : '<p class="text-muted text-sm">Aucune carte disponible.</p>';

    counterSection.innerHTML = `
      <div class="panel">
        <h3 style="margin-bottom:.75rem">↩ Contre-proposition</h3>
        <form id="counter-form" class="trade-form">
          <div class="trade-form-panels">
            <div>
              <label class="form-label">Je propose (mes cartes)</label>
              <div class="card-checkbox-list">${checkboxList(myCards, 'offered')}</div>
            </div>
            <div>
              <label class="form-label">Je veux (ses cartes)</label>
              <div class="card-checkbox-list">${checkboxList(theirCards, 'requested')}</div>
            </div>
          </div>

          <div class="form-group">
            <label class="form-label">Message <span style="color:var(--color-accent)">*</span></label>
            <textarea class="form-textarea" name="message" placeholder="Expliquez votre contre-proposition…" rows="3"></textarea>
          </div>

          <div id="counter-error" class="form-error hidden"></div>

          <div style="display:flex;gap:.5rem">
            <button type="submit" class="btn btn-warning">Envoyer la contre-proposition</button>
            <button type="button" id="btn-cancel-counter" class="btn btn-ghost">Annuler</button>
          </div>
        </form>
      </div>
    `;

    // Sélection visuelle
    counterSection.querySelectorAll('.card-checkbox-item input').forEach((cb) => {
      cb.addEventListener('change', () => {
        cb.closest('.card-checkbox-item').classList.toggle('selected', cb.checked);
      });
    });

    counterSection.querySelector('#btn-cancel-counter').addEventListener('click', () => {
      counterSection.remove();
      // Restaure les boutons d'action
      renderNegotiationThread(container.closest('#main-content'), parseInt(window.location.hash.split('/')[1]), currentUser);
    });

    counterSection.querySelector('#counter-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const form = e.target;
      const errorEl = form.querySelector('#counter-error');
      const offeredCardIds = [...form.querySelectorAll('input[name="offered"]:checked')].map((i) => parseInt(i.value));
      const requestedCardIds = [...form.querySelectorAll('input[name="requested"]:checked')].map((i) => parseInt(i.value));
      const message = form.querySelector('[name="message"]').value.trim();

      if (!message) {
        errorEl.textContent = 'Un message est requis pour la contre-proposition.';
        errorEl.classList.remove('hidden');
        return;
      }

      const submitBtn = form.querySelector('button[type="submit"]');
      await withLoading(submitBtn, '⌛ Envoi…', async () => {
        const { trade: newTrade } = await api.counterTrade(tradeId, { offeredCardIds, requestedCardIds, message });
        window.location.hash = `#trade/${newTrade.id}`;
      });
    });
  });
}

// ── Navigation dans la chaîne de négociation ──────────────────────────────────
function buildChainNav(trade) {
  const links = [];

  if (trade.parentTradeId) {
    links.push(`
      <a href="#trade/${trade.parentTradeId}" class="chain-link">
        ← Proposition précédente <span class="text-muted">#${trade.parentTradeId}</span>
      </a>`);
  }
  if (trade.counters?.length) {
    links.push(`
      <a href="#trade/${trade.counters[0].id}" class="chain-link">
        Contre-proposition <span class="text-muted">#${trade.counters[0].id}</span> →
      </a>`);
  }

  if (!links.length) return '';

  return `
    <div class="chain-nav">
      <span class="text-muted text-sm">Fil de négociation :</span>
      ${links.join('<span class="chain-sep">·</span>')}
    </div>`;
}

// ── Rendu des éléments ────────────────────────────────────────────────────────
function threadCardMini(tc) {
  const gameIcon = { POKEMON: '🔥', MAGIC: '✨', YUGIOH: '⚡', DIGIMON: '🌙', OTHER: '🃏' }[tc.card.game] || '🃏';
  return `
    <div class="thread-card-mini">
      <span>${gameIcon}</span>
      <span>${escapeHTML(tc.card.name)}</span>
      <span class="text-muted text-sm">(${tc.card.game})</span>
    </div>`;
}

function messageBubbleHTML(msg, currentUser) {
  const isMine = msg.authorId === currentUser.id;
  const isSystem = ['ACCEPT', 'REFUSE', 'COUNTER'].includes(msg.action);
  const cls = isSystem ? 'system' : isMine ? 'mine' : 'theirs';
  const time = relativeDate(new Date(msg.createdAt));

  return `
    <div class="message-bubble ${cls}">
      ${!isMine && !isSystem
      ? `<div class="message-author">${msg.author.avatar || '👤'} ${escapeHTML(msg.author.name)}</div>`
      : ''}
      <div>${escapeHTML(msg.body)}</div>
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

function cancelButtonHTML() {
  return `
    <div class="mt-2">
      <button id="btn-cancel-trade" class="btn btn-ghost btn-sm">
        ✕ Annuler ma proposition
      </button>
    </div>
  `;
}

function messageFormHTML() {
  return `
    <form id="message-form" class="message-form mt-2">
      <textarea
        class="form-textarea"
        placeholder="Ajouter un commentaire…"
        rows="2"
        style="flex:1"
      ></textarea>
      <button type="submit" class="btn btn-ghost">Envoyer</button>
    </form>
  `;
}

// ── Utilitaires ───────────────────────────────────────────────────────────────

/**
 * Désactive un bouton, affiche un label de chargement, exécute l'action,
 * puis restaure le bouton en cas d'erreur.
 */
async function withLoading(btn, loadingLabel, action, { restore = true } = {}) {
  const origHTML = btn.innerHTML;
  const origDisabled = btn.disabled;
  btn.disabled = true;
  btn.innerHTML = loadingLabel;
  btn.classList.add('loading');

  try {
    await action();
  } catch (err) {
    if (restore) {
      btn.disabled = origDisabled;
      btn.innerHTML = origHTML;
      btn.classList.remove('loading');
    }
    // Affichage de l'erreur dans la page (pas de alert())
    showInlineError(btn.closest('#thread-container') || document.body, err.message);
  }
}

function showInlineError(container, msg) {
  let errEl = container.querySelector('.thread-error');
  if (!errEl) {
    errEl = document.createElement('div');
    errEl.className = 'thread-error form-error mt-1';
    const actions = container.querySelector('.thread-actions') || container.querySelector('#message-form');
    actions?.insertAdjacentElement('afterend', errEl);
  }
  errEl.textContent = msg;
  errEl.classList.remove('hidden');
  setTimeout(() => errEl.classList.add('hidden'), 5000);
}

function statusLabel(status) {
  return {
    PENDING: 'En attente',
    ACCEPTED: 'Accepté',
    REFUSED: 'Refusé',
    COUNTERED: 'Contre-proposition',
    CANCELLED: 'Annulé',
  }[status] || status;
}

function escapeHTML(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
