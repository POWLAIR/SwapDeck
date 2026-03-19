/**
 * NegotiationCommandService — CQRS Write Side
 *
 * Contient toutes les actions qui modifient l'état du système :
 * créer une proposition, accepter, refuser, contre-proposer, annuler, commenter.
 *
 * Chaque méthode valide les préconditions métier et lève une erreur typée
 * si elles ne sont pas remplies. Le middleware errorHandler mappe ces erreurs
 * vers les codes HTTP appropriés.
 */

const prisma = require('../config/db');

const OPEN_STATUSES = ['PENDING'];

/**
 * Crée une nouvelle proposition d'échange.
 */
async function createTrade(initiatorId, recipientId, offeredCardIds, requestedCardIds, messageBody) {
  if (!recipientId || !messageBody?.trim()) {
    throw new Error('VALIDATION');
  }
  if (!offeredCardIds?.length && !requestedCardIds?.length) {
    throw new Error('VALIDATION');
  }
  if (initiatorId === recipientId) {
    throw new Error('VALIDATION');
  }

  // Vérifie que les cartes offertes appartiennent bien à l'initiateur
  if (offeredCardIds?.length) {
    const ownedCards = await prisma.card.findMany({
      where: { id: { in: offeredCardIds }, ownerId: initiatorId },
    });
    if (ownedCards.length !== offeredCardIds.length) {
      throw new Error('UNAUTHORIZED');
    }
  }

  // Vérifie que les cartes demandées appartiennent bien au destinataire
  if (requestedCardIds?.length) {
    const recipientCards = await prisma.card.findMany({
      where: { id: { in: requestedCardIds }, ownerId: recipientId },
    });
    if (recipientCards.length !== requestedCardIds.length) {
      throw new Error('UNAUTHORIZED');
    }
  }

  const trade = await prisma.trade.create({
    data: {
      initiatorId,
      recipientId,
      status: 'PENDING',
      tradeCards: {
        create: [
          ...(offeredCardIds || []).map((cardId) => ({ cardId, direction: 'OFFERED' })),
          ...(requestedCardIds || []).map((cardId) => ({ cardId, direction: 'REQUESTED' })),
        ],
      },
      messages: {
        create: { authorId: initiatorId, body: messageBody, action: 'PROPOSE' },
      },
    },
    include: _tradeIncludes(),
  });

  return trade;
}

/**
 * Accepte une proposition d'échange.
 */
async function acceptTrade(tradeId, actorId) {
  const trade = await _getOrThrow(tradeId);

  if (trade.recipientId !== actorId) throw new Error('UNAUTHORIZED');
  if (!OPEN_STATUSES.includes(trade.status)) throw new Error('INVALID_STATUS');

  return prisma.trade.update({
    where: { id: tradeId },
    data: {
      status: 'ACCEPTED',
      messages: {
        create: { authorId: actorId, body: 'Proposition acceptée.', action: 'ACCEPT' },
      },
    },
    include: _tradeIncludes(),
  });
}

/**
 * Refuse une proposition d'échange.
 */
async function refuseTrade(tradeId, actorId) {
  const trade = await _getOrThrow(tradeId);

  if (trade.recipientId !== actorId) throw new Error('UNAUTHORIZED');
  if (!OPEN_STATUSES.includes(trade.status)) throw new Error('INVALID_STATUS');

  return prisma.trade.update({
    where: { id: tradeId },
    data: {
      status: 'REFUSED',
      messages: {
        create: { authorId: actorId, body: 'Proposition refusée.', action: 'REFUSE' },
      },
    },
    include: _tradeIncludes(),
  });
}

/**
 * Émet une contre-proposition.
 * La trade originale passe à COUNTERED, une nouvelle trade liée est créée.
 */
async function counterTrade(tradeId, actorId, offeredCardIds, requestedCardIds, messageBody) {
  const trade = await _getOrThrow(tradeId);

  if (trade.recipientId !== actorId) throw new Error('UNAUTHORIZED');
  if (!OPEN_STATUSES.includes(trade.status)) throw new Error('INVALID_STATUS');
  if (!messageBody?.trim()) throw new Error('VALIDATION');

  // Marque la trade originale comme COUNTERED
  await prisma.trade.update({
    where: { id: tradeId },
    data: {
      status: 'COUNTERED',
      messages: {
        create: { authorId: actorId, body: 'Contre-proposition émise.', action: 'COUNTER' },
      },
    },
  });

  // Crée la nouvelle trade (les rôles sont inversés)
  const newTrade = await prisma.trade.create({
    data: {
      initiatorId: actorId,
      recipientId: trade.initiatorId,
      status: 'PENDING',
      parentTradeId: tradeId,
      tradeCards: {
        create: [
          ...(offeredCardIds || []).map((cardId) => ({ cardId, direction: 'OFFERED' })),
          ...(requestedCardIds || []).map((cardId) => ({ cardId, direction: 'REQUESTED' })),
        ],
      },
      messages: {
        create: { authorId: actorId, body: messageBody, action: 'PROPOSE' },
      },
    },
    include: _tradeIncludes(),
  });

  return newTrade;
}

/**
 * Annule une proposition (initiateur seulement, si encore en attente).
 */
async function cancelTrade(tradeId, actorId) {
  const trade = await _getOrThrow(tradeId);

  if (trade.initiatorId !== actorId) throw new Error('UNAUTHORIZED');
  if (!OPEN_STATUSES.includes(trade.status)) throw new Error('INVALID_STATUS');

  return prisma.trade.update({
    where: { id: tradeId },
    data: { status: 'CANCELLED' },
    include: _tradeIncludes(),
  });
}

/**
 * Ajoute un message libre dans une transaction ouverte.
 */
async function addMessage(tradeId, authorId, body) {
  const trade = await _getOrThrow(tradeId);

  const isParticipant = trade.initiatorId === authorId || trade.recipientId === authorId;
  if (!isParticipant) throw new Error('UNAUTHORIZED');
  if (!['PENDING', 'COUNTERED'].includes(trade.status)) throw new Error('INVALID_STATUS');
  if (!body?.trim()) throw new Error('VALIDATION');

  return prisma.message.create({
    data: { tradeId, authorId, body: body.trim(), action: 'COMMENT' },
    include: { author: { select: { id: true, name: true, handle: true, avatar: true } } },
  });
}

// --- Helpers privés ---

async function _getOrThrow(tradeId) {
  const trade = await prisma.trade.findUnique({ where: { id: tradeId } });
  if (!trade) throw new Error('NOT_FOUND');
  return trade;
}

function _tradeIncludes() {
  return {
    initiator: { select: { id: true, name: true, handle: true, avatar: true } },
    recipient: { select: { id: true, name: true, handle: true, avatar: true } },
    tradeCards: {
      include: { card: { include: { owner: { select: { id: true, name: true } } } } },
    },
    messages: {
      include: { author: { select: { id: true, name: true, handle: true, avatar: true } } },
      orderBy: { createdAt: 'asc' },
    },
  };
}

module.exports = {
  createTrade,
  acceptTrade,
  refuseTrade,
  counterTrade,
  cancelTrade,
  addMessage,
};
