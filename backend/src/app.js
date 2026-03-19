const express = require('express');
const session = require('express-session');
const cors = require('cors');
const path = require('path');

const { errorHandler } = require('./middleware/errorHandler');
const { requireAuth } = require('./middleware/auth');

const authRoutes = require('./routes/auth.routes');
const cardRoutes = require('./routes/card.routes');
const tradeRoutes = require('./routes/trade.routes');
const messageRoutes = require('./routes/message.routes');
const imageRoutes = require('./routes/images.routes');

const app = express();

// Middlewares
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(
  session({
    secret: process.env.SESSION_SECRET || 'swapdeck-dev-secret',
    resave: false,
    saveUninitialized: false,
    cookie: { httpOnly: true, maxAge: 24 * 60 * 60 * 1000 },
  })
);

// Static frontend
app.use(express.static(path.join(__dirname, '../../frontend')));

// Public routes
app.use('/api/auth', authRoutes);
app.use('/api/images', imageRoutes);

// Protected routes
app.use('/api/cards', requireAuth, cardRoutes);
app.use('/api/trades', requireAuth, tradeRoutes);
app.use('/api/trades', requireAuth, messageRoutes);

// SPA fallback
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../../frontend/index.html'));
});

// Error handler (must be last)
app.use(errorHandler);

module.exports = app;
