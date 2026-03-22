const NegotiationCommandService = require('../services/NegotiationCommandService');
const NegotiationQueryService = require('../services/NegotiationQueryService');

async function create(req, res, next) {
  try {
    const { recipientId, offeredCardIds, requestedCardIds, message } = req.body;
    const trade = await NegotiationCommandService.createTrade(
      req.user.id,
      parseInt(recipientId),
      offeredCardIds,
      requestedCardIds,
      message
    );
    res.status(201).json({ trade });
  } catch (err) {
    next(err);
  }
}

async function getAll(req, res, next) {
  try {
    const { status, role, page, limit } = req.query;
    const result = await NegotiationQueryService.getTradesForUser(req.user.id, {
      status,
      role,
      page: page ? parseInt(page) : 1,
      limit: limit ? parseInt(limit) : 20,
    });
    // result = { trades: [...], total, page, totalPages }
    // On renvoie à plat pour que le frontend puisse déstructurer { trades, total }
    res.json(result);
  } catch (err) {
    next(err);
  }
}

async function getOne(req, res, next) {
  try {
    const trade = await NegotiationQueryService.getTradeById(
      parseInt(req.params.id),
      req.user.id
    );
    res.json({ trade });
  } catch (err) {
    next(err);
  }
}

async function accept(req, res, next) {
  try {
    const trade = await NegotiationCommandService.acceptTrade(
      parseInt(req.params.id),
      req.user.id
    );
    res.json({ trade });
  } catch (err) {
    next(err);
  }
}

async function refuse(req, res, next) {
  try {
    const trade = await NegotiationCommandService.refuseTrade(
      parseInt(req.params.id),
      req.user.id
    );
    res.json({ trade });
  } catch (err) {
    next(err);
  }
}

async function counter(req, res, next) {
  try {
    const { offeredCardIds, requestedCardIds, message } = req.body;
    const trade = await NegotiationCommandService.counterTrade(
      parseInt(req.params.id),
      req.user.id,
      offeredCardIds,
      requestedCardIds,
      message
    );
    res.status(201).json({ trade });
  } catch (err) {
    next(err);
  }
}

async function cancel(req, res, next) {
  try {
    const trade = await NegotiationCommandService.cancelTrade(
      parseInt(req.params.id),
      req.user.id
    );
    res.json({ trade });
  } catch (err) {
    next(err);
  }
}

module.exports = { create, getAll, getOne, accept, refuse, counter, cancel };
