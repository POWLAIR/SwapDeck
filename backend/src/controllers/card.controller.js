const CardService = require('../services/card.service');

async function getAll(req, res, next) {
  try {
    const { game, ownerId } = req.query;
    const filters = {};
    if (game) filters.game = game;
    if (ownerId) filters.ownerId = parseInt(ownerId);

    const cards = await CardService.getAllCards(filters);
    res.json({ cards });
  } catch (err) {
    next(err);
  }
}

async function getOne(req, res, next) {
  try {
    const card = await CardService.getCardById(parseInt(req.params.id));
    if (!card) return res.status(404).json({ error: 'Carte introuvable' });
    res.json({ card });
  } catch (err) {
    next(err);
  }
}

module.exports = { getAll, getOne };
