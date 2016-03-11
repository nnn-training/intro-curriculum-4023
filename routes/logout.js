'use strict';
let express = require('express');
let router = express.Router();

router.get('/', (req, res, next) => {
  req.logout();
  res.redirect('/');
});

module.exports = router;
