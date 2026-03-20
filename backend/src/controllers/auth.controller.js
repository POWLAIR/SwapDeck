const prisma = require('../config/db');

async function login(req, res, next) {
  try {
    const { handle } = req.body;
    if (!handle) return res.status(400).json({ error: 'Handle requis' });

    const user = await prisma.user.findUnique({ where: { handle } });
    if (!user) return res.status(404).json({ error: 'Utilisateur introuvable' });

    req.session.userId = user.id;
    res.json({ user });
  } catch (err) {
    next(err);
  }
}

function logout(req, res) {
  req.session.destroy(() => {
    res.json({ message: 'Déconnecté' });
  });
}

function me(req, res) {
  res.json({ user: req.user });
}

module.exports = { login, logout, me };
