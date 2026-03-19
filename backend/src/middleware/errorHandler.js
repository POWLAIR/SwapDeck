function errorHandler(err, req, res, next) {
  const statusMap = {
    UNAUTHORIZED: 403,
    NOT_FOUND: 404,
    INVALID_STATUS: 409,
    VALIDATION: 400,
  };

  const status = statusMap[err.message] || 500;
  const message =
    status === 500 ? 'Erreur interne du serveur' : err.message;

  if (status === 500) console.error(err);

  res.status(status).json({ error: message });
}

module.exports = { errorHandler };
