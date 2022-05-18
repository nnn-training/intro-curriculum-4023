'use strict';

function ensure(req, res, next) {
  if (req.isAuthenticated()) {
    return next();
  }
  res.redirect('/login?from=' + req.originalUrl);
}

module.exports = ensure;
