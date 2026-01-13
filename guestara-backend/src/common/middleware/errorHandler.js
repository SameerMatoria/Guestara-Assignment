function errorHandler(err, req, res, next) {
  const status = err.statusCode || 500;

  res.status(status).json({
    message: err.message || "Internal Server Error",
    // helpful in dev, hidden in prod
    ...(process.env.NODE_ENV !== "production" && { stack: err.stack }),
  });
}

module.exports = { errorHandler };
