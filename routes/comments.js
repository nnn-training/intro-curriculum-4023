'use strict'

const express = require('express');
const router = express.Router();
const { param, body, validationResult } = require('express-validator');
const ensurer = require('./authentication-ensurer');
const { PrismaClient } = require('@prisma/client');
const { val } = require('./schedules');
const prisma = new PrismaClient({ log: ['query'] });

// コメントを追加するWebAPIになるらしい

/* GET comments listing. */
router.post('/:scheduleId/comments', ensurer, async function (req, res, next) {

  await body('comment').isString().withMessage('文字列で入力してください').run(req);
  await param('scheduleId').isUUID(4).withMessage('有効な予定IDを指定してください').run(req);
  const errors = validationResult(req);

  console.log(req.body, req.params.scheduleId);
  console.log(errors.array());
  if(!errors.isEmpty()) {
    return res.status(400).json({ status: 'NG', errors: errors.array() });
  }
  // NOTE これ別にtry-catchなくてもデータベースエラーは平気じゃないかな...

  try {
    const data = {
      userId: req.user,
      scheduleId: req.params.scheduleId,
      comment: (req.body.comment).slice(0, 255)
    };
    await prisma.comment.upsert({
      where: { commentCompositeId: { userId: data.userId, scheduleId: data.scheduleId } },
      update: data,
      create: data
    });
    res.json({ status: 'OK', comment: data.comment });
  } catch (err) {
    next(val(err));
  }
});

router.get('/:scheduleId/comments', async function (req, res, next) {
  try {
    const db = await prisma.comment.findMany({
      where: {scheduleId: req.params.scheduleId}
    });
    res.json({ status: 'OK', comment: db });
  } catch (err) {
    next(val('お探しの予定は見つかりませんでした'));
  }
})

module.exports = router;