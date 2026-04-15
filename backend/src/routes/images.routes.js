const express = require('express');
const router = express.Router();
const { getCardImage } = require('../controllers/images.controller');

// GET /api/images/card?game=POKEMON&name=Charizard+ex
// Route publique — pas d'authentification requise
router.get('/card', getCardImage);

module.exports = router;
