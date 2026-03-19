const express = require('express');
const router = express.Router();
const cardController = require('../controllers/card.controller');

router.get('/', cardController.getAll);
router.get('/:id', cardController.getOne);

module.exports = router;
