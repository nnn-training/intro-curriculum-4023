'use strict';
const express = require('express');
const router = express.Router();
const authenticationEnsurer = require('./authentication-ensurer');
const Availability = require('../models/availability');

router.post(
  '/:scheduleId/users/:userId/candidates/:candidateId',
  authenticationEnsurer,
  async (req, res, next) => {
    const scheduleId = req.params.scheduleId;
    const userId = req.params.userId;
    const candidateId = req.params.candidateId;
    let availability = req.body.availability;
    availability = availability ? parseInt(availability) : 0;

    await Availability.upsert({
      scheduleId: scheduleId,
      userId: userId,
      candidateId: candidateId,
      availability: availability
    });
    res.json({ status: 'OK', availability: availability });
  }
);

module.exports = router;
