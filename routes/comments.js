'use strict';
const express = require('express');
const router = express.Router();
const { param, body, validationResult } = require('express-validator');
const authenticationEnsurer = require('./authentication-ensurer');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient({ log: [ 'query' ] });

router.post(
  '/:scheduleId/users/:userId/comments',
  authenticationEnsurer,
  async (req, res, next) => {
    await body('comment').isString().withMessage('コメントを入力してください。').run(req);
    await param('scheduleId').isUUID('4').withMessage('有効なスケジュール ID を指定してください。').run(req);
    await param('userId').isInt().custom((value, { req }) => {
      return parseInt(value) === parseInt(req.user.id);
    }).withMessage('ユーザー ID が不正です。').run(req);
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
      return res.status(400).json({ status: 'NG', errors: errors.array() });
    }

    const scheduleId = req.params.scheduleId;
    const userId = parseInt(req.params.userId);
    const comment = req.body.comment;

    const data = {
      userId,
      scheduleId,
      comment: comment.slice(0, 255)
    };

    try {
      await prisma.comment.upsert({
        where: {
          commentCompositeId: {
            userId,
            scheduleId
          }
        },
        update: data,
        create: data
      });
      res.status(200).json({ status: 'OK', comment: comment });
    } catch (error) {
      console.error(error);
      res.status(500).json({ status: 'NG', errors: [{ msg: 'データベース エラー。' }] });
    }
  }
);

module.exports = router;
