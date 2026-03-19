const NegotiationCommandService = require('../services/NegotiationCommandService');
const NegotiationQueryService = require('../services/NegotiationQueryService');

async function getMessages(req, res, next) {
  try {
    const messages = await NegotiationQueryService.getTradeMessages(
      parseInt(req.params.id),
      req.user.id
    );
    res.json({ messages });
  } catch (err) {
    next(err);
  }
}

async function addMessage(req, res, next) {
  try {
    const { body } = req.body;
    const message = await NegotiationCommandService.addMessage(
      parseInt(req.params.id),
      req.user.id,
      body
    );
    res.status(201).json({ message });
  } catch (err) {
    next(err);
  }
}

module.exports = { getMessages, addMessage };
