/**
 * NegotiationQueryService — CQRS Read Side
 *
 * Contient toutes les lectures de l'état du système.
 * Aucun effet de bord, aucune mutation de données.
 *
 * Méthodes :
 *   - getTradeById       : détail complet d'une trade (participant uniquement)
 *   - getTradesForUser   : liste paginée des trades d'un utilisateur
 *   - getNegotiationThread : chaîne complète des contre-propositions
 *   - getTradeMessages   : historique des messages d'une trade
 */

const prisma = require('../config/db');

/**
 * Retourne le détail complet d'une trade.
 * Erreur UNAUTHORIZED si le demandeur n'est pas participant.
 */
async function getTradeById(tradeId, requestorId) {
  const trade = await prisma.trade.findUnique({
    where: { id: tradeId },
    include: _tradeIncludes(),
  });

  if (!trade) throw new Error('NOT_FOUND');
  _assertParticipant(trade, requestorId);

  return trade;
}

/**
 * Liste paginée des trades d'un utilisateur.
 * @param {number} userId
 * @param {{ status?, role: 'sent'|'received'|'all', page, limit }} filters
 */
async function getTradesForUser(userId, filters = {}) {
  const { status, role = 'all', page = 1, limit = 20 } = filters;

  const where = {};

  if (role === 'sent') where.initiatorId = userId;
  else if (role === 'received') where.recipientId = userId;
  else where.OR = [{ initiatorId: userId }, { recipientId: userId }];

  if (status) where.status = status;

  const [total, trades] = await Promise.all([
    prisma.trade.count({ where }),
    prisma.trade.findMany({
      where,
      include: {
        initiator: { select: { id: true, name: true, handle: true, avatar: true } },
        recipient: { select: { id: true, name: true, handle: true, avatar: true } },
        _count: { select: { messages: true, tradeCards: true } },
      },
      orderBy: { updatedAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
  ]);

  return { trades, total, page, totalPages: Math.ceil(total / limit) };
}

/**
 * Retourne la chaîne complète de négociation (parent + contre-propositions).
 * Résultat trié du plus ancien au plus récent.
 */
async function getNegotiationThread(tradeId, requestorId) {
  const trade = await prisma.trade.findUnique({
    where: { id: tradeId },
    include: _tradeIncludes(),
  });

  if (!trade) throw new Error('NOT_FOUND');
  _assertParticipant(trade, requestorId);

  // Remonte jusqu'à la racine
  const root = await _findRoot(trade);

  // Descend toute la chaîne depuis la racine
  const chain = await _buildChain(root.id);

  return chain;
}

/**
 * Retourne toutes les négociations impliquant une carte donnée.
 * Couvre les trades où la carte est offerte ou demandée.
 * @param {number} cardId
 * @param {number} requestorId - doit être participant ou propriétaire de la carte
 */
async function getTradesByCard(cardId, requestorId) {
  const trades = await prisma.trade.findMany({
    where: {
      tradeCards: { some: { cardId } },
      OR: [{ initiatorId: requestorId }, { recipientId: requestorId }],
    },
    include: {
      initiator: { select: { id: true, name: true, handle: true, avatar: true } },
      recipient: { select: { id: true, name: true, handle: true, avatar: true } },
      tradeCards: {
        where: { cardId },
        include: { card: { select: { id: true, name: true, game: true } } },
      },
      _count: { select: { messages: true } },
    },
    orderBy: { updatedAt: 'desc' },
  });

  return trades;
}

/**
 * Retourne les messages d'une trade, triés par date croissante.
 */
async function getTradeMessages(tradeId, requestorId) {
  const trade = await prisma.trade.findUnique({ where: { id: tradeId } });
  if (!trade) throw new Error('NOT_FOUND');
  _assertParticipant(trade, requestorId);

  return prisma.message.findMany({
    where: { tradeId },
    include: { author: { select: { id: true, name: true, handle: true, avatar: true } } },
    orderBy: { createdAt: 'asc' },
  });
}

// --- Helpers privés ---

function _assertParticipant(trade, userId) {
  if (trade.initiatorId !== userId && trade.recipientId !== userId) {
    throw new Error('UNAUTHORIZED');
  }
}

async function _findRoot(trade) {
  if (!trade.parentTradeId) return trade;
  const parent = await prisma.trade.findUnique({
    where: { id: trade.parentTradeId },
    include: _tradeIncludes(),
  });
  return _findRoot(parent);
}

async function _buildChain(tradeId) {
  const trade = await prisma.trade.findUnique({
    where: { id: tradeId },
    include: { ..._tradeIncludes(), counters: { select: { id: true } } },
  });

  const result = [trade];

  for (const counter of trade.counters) {
    const subChain = await _buildChain(counter.id);
    result.push(...subChain);
  }

  return result;
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
  getTradeById,
  getTradesForUser,
  getTradesByCard,
  getNegotiationThread,
  getTradeMessages,
};
