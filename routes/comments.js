'use strict';
let express = require('express');
let router = express.Router();
let authenticationEnsurer = require('./authendication-ensurer');
let Comment = require('../models/comment');

router.post('/:scheduleId/users/:userId/comments', authenticationEnsurer, (req, res, next) => {
  let scheduleId = req.params.scheduleId;
  let userId = req.params.userId;
  let comment = req.body.comment;

  Comment.upsert({
    scheduleId: scheduleId,
    userId: userId,
    comment: comment.slice(0, 255)
  }).then(() => {
    res.json({ status: 'OK', comment: comment });
  });
});

module.exports = router;
