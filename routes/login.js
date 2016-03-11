'use strict';
let express = require('express');
let router = express.Router();

router.get('/', (req, res, next) => {
  let from = req.query.from;
  if (from) {
    res.cookie('loginFrom', from, { expires: new Date(Date.now() + 600000)});
  }
  res.render('login');
});

module.exports = router;
