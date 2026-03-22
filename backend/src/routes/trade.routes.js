const express = require('express');
const router = express.Router();
const tradeController = require('../controllers/trade.controller');

router.post('/', tradeController.create);
router.get('/', tradeController.getAll);
router.get('/:id', tradeController.getOne);
router.post('/:id/accept', tradeController.accept);
router.post('/:id/refuse', tradeController.refuse);
router.post('/:id/counter', tradeController.counter);
router.post('/:id/cancel', tradeController.cancel);

module.exports = router;
