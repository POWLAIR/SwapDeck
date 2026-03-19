/**
 * Tests unitaires — NegotiationCommandService (CQRS Write Side)
 *
 * Le client Prisma est mocké : aucune base de données réelle n'est nécessaire.
 * On vérifie les règles métier (validation, autorisations, transitions d'état).
 */

jest.mock('../../backend/src/config/db', () => ({
  card:    { findMany: jest.fn(), findUnique: jest.fn() },
  trade:   { findUnique: jest.fn(), create: jest.fn(), update: jest.fn() },
  message: { create: jest.fn() },
}));

const prisma = require('../../backend/src/config/db');
const service = require('../../backend/src/services/NegotiationCommandService');

// Helper : fabrique un trade fictif
const makeTrade = (overrides = {}) => ({
  id: 1,
  initiatorId: 1,
  recipientId: 2,
  status: 'PENDING',
  ...overrides,
});

beforeEach(() => {
  jest.clearAllMocks();
});

// ──────────────────────────────────────────────
// createTrade
// ──────────────────────────────────────────────
describe('createTrade', () => {
  it('crée une trade valide', async () => {
    prisma.card.findMany
      .mockResolvedValueOnce([{ id: 10, ownerId: 1 }])  // offered
      .mockResolvedValueOnce([{ id: 20, ownerId: 2 }]); // requested

    const fakeTrade = makeTrade();
    prisma.trade.create.mockResolvedValue(fakeTrade);

    const result = await service.createTrade(1, 2, [10], [20], 'Échange SVP');

    expect(prisma.trade.create).toHaveBeenCalledTimes(1);
    expect(result).toEqual(fakeTrade);
  });

  it('rejette si initiateur === destinataire', async () => {
    await expect(service.createTrade(1, 1, [10], [20], 'test')).rejects.toThrow('VALIDATION');
  });

  it('rejette si aucune carte sélectionnée', async () => {
    await expect(service.createTrade(1, 2, [], [], 'test')).rejects.toThrow('VALIDATION');
  });

  it('rejette si message absent', async () => {
    await expect(service.createTrade(1, 2, [10], [20], '')).rejects.toThrow('VALIDATION');
  });

  it("rejette si les cartes offertes n'appartiennent pas à l'initiateur", async () => {
    // findMany retourne moins de cartes → propriété incorrecte
    prisma.card.findMany.mockResolvedValueOnce([]);
    await expect(service.createTrade(1, 2, [99], [], 'test')).rejects.toThrow('UNAUTHORIZED');
  });

  it("rejette si les cartes demandées n'appartiennent pas au destinataire", async () => {
    prisma.card.findMany
      .mockResolvedValueOnce([{ id: 10, ownerId: 1 }]) // offered OK
      .mockResolvedValueOnce([]);                        // requested KO
    await expect(service.createTrade(1, 2, [10], [99], 'test')).rejects.toThrow('UNAUTHORIZED');
  });
});

// ──────────────────────────────────────────────
// acceptTrade
// ──────────────────────────────────────────────
describe('acceptTrade', () => {
  it('accepte si acteur est le destinataire et status PENDING', async () => {
    prisma.trade.findUnique.mockResolvedValue(makeTrade());
    prisma.trade.update.mockResolvedValue(makeTrade({ status: 'ACCEPTED' }));

    const result = await service.acceptTrade(1, 2);

    expect(prisma.trade.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'ACCEPTED' }) })
    );
    expect(result.status).toBe('ACCEPTED');
  });

  it("rejette si l'acteur n'est pas le destinataire", async () => {
    prisma.trade.findUnique.mockResolvedValue(makeTrade());
    await expect(service.acceptTrade(1, 1)).rejects.toThrow('UNAUTHORIZED');
  });

  it('rejette si la trade est déjà clôturée', async () => {
    prisma.trade.findUnique.mockResolvedValue(makeTrade({ status: 'ACCEPTED' }));
    await expect(service.acceptTrade(1, 2)).rejects.toThrow('INVALID_STATUS');
  });

  it('lève NOT_FOUND si la trade est introuvable', async () => {
    prisma.trade.findUnique.mockResolvedValue(null);
    await expect(service.acceptTrade(999, 2)).rejects.toThrow('NOT_FOUND');
  });
});

// ──────────────────────────────────────────────
// refuseTrade
// ──────────────────────────────────────────────
describe('refuseTrade', () => {
  it('refuse si acteur est le destinataire et status PENDING', async () => {
    prisma.trade.findUnique.mockResolvedValue(makeTrade());
    prisma.trade.update.mockResolvedValue(makeTrade({ status: 'REFUSED' }));

    const result = await service.refuseTrade(1, 2);
    expect(result.status).toBe('REFUSED');
  });

  it("rejette si l'acteur n'est pas le destinataire", async () => {
    prisma.trade.findUnique.mockResolvedValue(makeTrade());
    await expect(service.refuseTrade(1, 1)).rejects.toThrow('UNAUTHORIZED');
  });

  it('rejette si la trade est déjà clôturée', async () => {
    prisma.trade.findUnique.mockResolvedValue(makeTrade({ status: 'REFUSED' }));
    await expect(service.refuseTrade(1, 2)).rejects.toThrow('INVALID_STATUS');
  });
});

// ──────────────────────────────────────────────
// counterTrade
// ──────────────────────────────────────────────
describe('counterTrade', () => {
  it('crée une contre-proposition et marque la trade originale COUNTERED', async () => {
    prisma.trade.findUnique.mockResolvedValue(makeTrade());
    prisma.trade.update.mockResolvedValue(makeTrade({ status: 'COUNTERED' }));
    prisma.trade.create.mockResolvedValue(makeTrade({ id: 2, initiatorId: 2, recipientId: 1, parentTradeId: 1 }));

    const result = await service.counterTrade(1, 2, [20], [10], 'Contre-offre !');

    expect(prisma.trade.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'COUNTERED' }) })
    );
    expect(prisma.trade.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ parentTradeId: 1, initiatorId: 2, recipientId: 1 }),
      })
    );
    expect(result.parentTradeId).toBe(1);
  });

  it("rejette si l'acteur n'est pas le destinataire", async () => {
    prisma.trade.findUnique.mockResolvedValue(makeTrade());
    await expect(service.counterTrade(1, 99, [], [], 'test')).rejects.toThrow('UNAUTHORIZED');
  });

  it('rejette si le message est vide', async () => {
    prisma.trade.findUnique.mockResolvedValue(makeTrade());
    await expect(service.counterTrade(1, 2, [], [], '')).rejects.toThrow('VALIDATION');
  });

  it('rejette si status pas PENDING', async () => {
    prisma.trade.findUnique.mockResolvedValue(makeTrade({ status: 'ACCEPTED' }));
    await expect(service.counterTrade(1, 2, [], [], 'test')).rejects.toThrow('INVALID_STATUS');
  });
});

// ──────────────────────────────────────────────
// cancelTrade
// ──────────────────────────────────────────────
describe('cancelTrade', () => {
  it("annule si l'acteur est l'initiateur et status PENDING", async () => {
    prisma.trade.findUnique.mockResolvedValue(makeTrade());
    prisma.trade.update.mockResolvedValue(makeTrade({ status: 'CANCELLED' }));

    const result = await service.cancelTrade(1, 1);
    expect(result.status).toBe('CANCELLED');
  });

  it("rejette si l'acteur n'est pas l'initiateur", async () => {
    prisma.trade.findUnique.mockResolvedValue(makeTrade());
    await expect(service.cancelTrade(1, 2)).rejects.toThrow('UNAUTHORIZED');
  });
});

// ──────────────────────────────────────────────
// addMessage
// ──────────────────────────────────────────────
describe('addMessage', () => {
  it('ajoute un message pour un participant', async () => {
    prisma.trade.findUnique.mockResolvedValue(makeTrade());
    prisma.message.create.mockResolvedValue({ id: 1, body: 'Bonjour', authorId: 1 });

    const result = await service.addMessage(1, 1, 'Bonjour');
    expect(result.body).toBe('Bonjour');
  });

  it('rejette si body vide', async () => {
    prisma.trade.findUnique.mockResolvedValue(makeTrade());
    await expect(service.addMessage(1, 1, '   ')).rejects.toThrow('VALIDATION');
  });

  it("rejette si l'auteur n'est pas participant", async () => {
    prisma.trade.findUnique.mockResolvedValue(makeTrade());
    await expect(service.addMessage(1, 99, 'Bonjour')).rejects.toThrow('UNAUTHORIZED');
  });

  it('rejette si la trade est clôturée', async () => {
    prisma.trade.findUnique.mockResolvedValue(makeTrade({ status: 'ACCEPTED' }));
    await expect(service.addMessage(1, 1, 'Bonjour')).rejects.toThrow('INVALID_STATUS');
  });
});
