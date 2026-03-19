const express = require('express');
const router = express.Router();
const messageController = require('../controllers/message.controller');

router.get('/:id/messages', messageController.getMessages);
router.post('/:id/messages', messageController.addMessage);

module.exports = router;
