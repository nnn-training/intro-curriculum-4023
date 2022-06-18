'use strict';
const express = require('express');
const router = express.Router();

router.get('/', (req, res, next) => {
  req.logout((err) => {
    if (err) return next(err);
    res.redirect('/');
  });
});

module.exports = router;
