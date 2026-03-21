const prisma = require('../config/db');

async function getAllCards(filters = {}) {
  return prisma.card.findMany({
    where: filters,
    include: { owner: { select: { id: true, name: true, handle: true, avatar: true } } },
    orderBy: { createdAt: 'desc' },
  });
}

async function getCardById(id) {
  return prisma.card.findUnique({
    where: { id },
    include: { owner: { select: { id: true, name: true, handle: true, avatar: true } } },
  });
}

module.exports = { getAllCards, getCardById };
