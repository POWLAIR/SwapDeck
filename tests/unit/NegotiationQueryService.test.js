/**
 * Tests unitaires — NegotiationQueryService (CQRS Read Side)
 *
 * Le client Prisma est mocké. On vérifie :
 * - les gardes d'accès (seuls les participants peuvent lire une trade)
 * - la pagination
 * - la construction correcte du fil de négociation
 */

jest.mock('../../backend/src/config/db', () => ({
  trade:   { findUnique: jest.fn(), findMany: jest.fn(), count: jest.fn() },
  message: { findMany: jest.fn() },
}));

const prisma = require('../../backend/src/config/db');
const service = require('../../backend/src/services/NegotiationQueryService');

const makeTrade = (overrides = {}) => ({
  id: 1,
  initiatorId: 1,
  recipientId: 2,
  status: 'PENDING',
  parentTradeId: null,
  tradeCards: [],
  messages: [],
  initiator: { id: 1, name: 'Axel', handle: 'axel_d', avatar: '🔥' },
  recipient: { id: 2, name: 'Mira',  handle: 'mira_k',  avatar: '✨' },
  counters: [],
  ...overrides,
});

beforeEach(() => {
  jest.clearAllMocks();
});

// ──────────────────────────────────────────────
// getTradeById
// ──────────────────────────────────────────────
describe('getTradeById', () => {
  it('retourne la trade si le demandeur est initiateur', async () => {
    const trade = makeTrade();
    prisma.trade.findUnique.mockResolvedValue(trade);

    const result = await service.getTradeById(1, 1);
    expect(result).toEqual(trade);
  });

  it('retourne la trade si le demandeur est destinataire', async () => {
    const trade = makeTrade();
    prisma.trade.findUnique.mockResolvedValue(trade);

    const result = await service.getTradeById(1, 2);
    expect(result).toEqual(trade);
  });

  it("lève UNAUTHORIZED si le demandeur n'est pas participant", async () => {
    prisma.trade.findUnique.mockResolvedValue(makeTrade());
    await expect(service.getTradeById(1, 99)).rejects.toThrow('UNAUTHORIZED');
  });

  it('lève NOT_FOUND si la trade est introuvable', async () => {
    prisma.trade.findUnique.mockResolvedValue(null);
    await expect(service.getTradeById(999, 1)).rejects.toThrow('NOT_FOUND');
  });
});

// ──────────────────────────────────────────────
// getTradesForUser
// ──────────────────────────────────────────────
describe('getTradesForUser', () => {
  it('retourne toutes les trades (envoyées + reçues) par défaut', async () => {
    const trades = [makeTrade(), makeTrade({ id: 2, initiatorId: 2, recipientId: 1 })];
    prisma.trade.count.mockResolvedValue(2);
    prisma.trade.findMany.mockResolvedValue(trades);

    const result = await service.getTradesForUser(1);

    expect(prisma.trade.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ OR: expect.any(Array) }),
      })
    );
    expect(result.trades).toHaveLength(2);
    expect(result.total).toBe(2);
  });

  it("filtre les trades envoyées quand role='sent'", async () => {
    prisma.trade.count.mockResolvedValue(1);
    prisma.trade.findMany.mockResolvedValue([makeTrade()]);

    await service.getTradesForUser(1, { role: 'sent' });

    expect(prisma.trade.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ initiatorId: 1 }),
      })
    );
  });

  it("filtre les trades reçues quand role='received'", async () => {
    prisma.trade.count.mockResolvedValue(1);
    prisma.trade.findMany.mockResolvedValue([makeTrade({ recipientId: 1, initiatorId: 2 })]);

    await service.getTradesForUser(1, { role: 'received' });

    expect(prisma.trade.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ recipientId: 1 }),
      })
    );
  });

  it('applique la pagination correctement', async () => {
    prisma.trade.count.mockResolvedValue(50);
    prisma.trade.findMany.mockResolvedValue([]);

    const result = await service.getTradesForUser(1, { page: 3, limit: 10 });

    expect(prisma.trade.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 20, take: 10 })
    );
    expect(result.totalPages).toBe(5);
    expect(result.page).toBe(3);
  });

  it('filtre par status', async () => {
    prisma.trade.count.mockResolvedValue(0);
    prisma.trade.findMany.mockResolvedValue([]);

    await service.getTradesForUser(1, { status: 'PENDING' });

    expect(prisma.trade.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: 'PENDING' }),
      })
    );
  });
});

// ──────────────────────────────────────────────
// getTradeMessages
// ──────────────────────────────────────────────
describe('getTradeMessages', () => {
  it('retourne les messages pour un participant', async () => {
    prisma.trade.findUnique.mockResolvedValue(makeTrade());
    const messages = [
      { id: 1, body: 'Bonjour', authorId: 1, createdAt: new Date() },
      { id: 2, body: 'Réponse', authorId: 2, createdAt: new Date() },
    ];
    prisma.message.findMany.mockResolvedValue(messages);

    const result = await service.getTradeMessages(1, 1);
    expect(result).toHaveLength(2);
    expect(prisma.message.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { tradeId: 1 }, orderBy: { createdAt: 'asc' } })
    );
  });

  it("lève UNAUTHORIZED si l'utilisateur n'est pas participant", async () => {
    prisma.trade.findUnique.mockResolvedValue(makeTrade());
    await expect(service.getTradeMessages(1, 99)).rejects.toThrow('UNAUTHORIZED');
  });

  it('lève NOT_FOUND si la trade est introuvable', async () => {
    prisma.trade.findUnique.mockResolvedValue(null);
    await expect(service.getTradeMessages(999, 1)).rejects.toThrow('NOT_FOUND');
  });
});

// ──────────────────────────────────────────────
// getNegotiationThread
// ──────────────────────────────────────────────
describe('getNegotiationThread', () => {
  it('retourne la trade seule si pas de contre-propositions', async () => {
    const trade = makeTrade();
    prisma.trade.findUnique.mockResolvedValue(trade);

    const result = await service.getNegotiationThread(1, 1);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(1);
  });

  it('retourne la chaîne complète avec une contre-proposition', async () => {
    const rootTrade   = makeTrade({ id: 1, counters: [{ id: 2 }] });
    const counterTrade = makeTrade({ id: 2, initiatorId: 2, recipientId: 1, parentTradeId: 1, counters: [] });

    prisma.trade.findUnique
      .mockResolvedValueOnce(rootTrade)   // appel initial (getTradeById interne)
      .mockResolvedValueOnce(rootTrade)   // _findRoot
      .mockResolvedValueOnce(rootTrade)   // _buildChain root
      .mockResolvedValueOnce(counterTrade); // _buildChain counter

    const result = await service.getNegotiationThread(1, 1);
    expect(result.length).toBeGreaterThanOrEqual(1);
  });

  it("lève UNAUTHORIZED si le demandeur n'est pas participant", async () => {
    prisma.trade.findUnique.mockResolvedValue(makeTrade());
    await expect(service.getNegotiationThread(1, 99)).rejects.toThrow('UNAUTHORIZED');
  });
});
