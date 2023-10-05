'use strict';
const express = require('express');
const router = express.Router();
const { param, body, validationResult } = require('express-validator');
const authenticationEnsurer = require('./authentication-ensurer');
const { v4: uuidv4 } = require('uuid');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient({ log: [ 'query' ] });

router.get('/new', authenticationEnsurer, (req, res, next) => {
  res.render('new', { user: req.user, csrfToken: req.csrfToken() });
});

router.post('/', authenticationEnsurer, async (req, res, next) => {
  await body('scheduleName').isString().run(req);
  await body('candidates').isString().run(req);
  await body('memo').isString().run(req);
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    const err = new Error('入力された情報が不十分または正しくありません。');
    err.status = 400;
    return next(err);
  }

  const scheduleId = uuidv4();
  const updatedAt = new Date();
  const schedule = await prisma.schedule.create({
    data: {
      scheduleId: scheduleId,
      scheduleName: req.body.scheduleName.slice(0, 255) || '（名称未設定）',
      memo: req.body.memo,
      createdBy: parseInt(req.user.id),
      updatedAt: updatedAt
    }
  });
  await createCandidatesAndRedirect(parseCandidateNames(req), schedule.scheduleId, res);
});

router.get('/:scheduleId', authenticationEnsurer, async (req, res, next) => {
  await param('scheduleId').isUUID('4').run(req);
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    const err = new Error('URL の形式が正しくありません。');
    err.status = 400;
    return next(err);
  }

  const schedule = await prisma.schedule.findUnique({
    where: { scheduleId: req.params.scheduleId },
    include: {
      user: {
        select: {
          userId: true,
          username: true
        }
      }
    }
  });
  if (schedule) {
    const candidates = await prisma.candidate.findMany({
      where: { scheduleId: schedule.scheduleId },
      orderBy: { candidateId: 'asc' }
    });
    // データベースからその予定の全ての出欠を取得する
    const availabilities = await prisma.availability.findMany({
      where: { scheduleId: schedule.scheduleId },
      orderBy: { candidateId: 'asc' },
      include: {
        user: {
          select: {
            userId: true,
            username: true
          }
        }
      }
    });
    // 出欠 MapMap を作成する
    const availabilityMapMap = new Map(); // key: userId, value: Map(key: candidateId, value: availability)
    availabilities.forEach((a) => {
      const map = availabilityMapMap.get(a.user.userId) || new Map();
      map.set(a.candidateId, a.availability);
      availabilityMapMap.set(a.user.userId, map);
    });

    // 閲覧ユーザと出欠に紐づくユーザからユーザ Map を作る
    const userMap = new Map(); // key: userId, value: User
    userMap.set(parseInt(req.user.id), {
        isSelf: true,
        userId: parseInt(req.user.id),
        username: req.user.username
    });
    availabilities.forEach((a) => {
      userMap.set(a.user.userId, {
        isSelf: parseInt(req.user.id) === a.user.userId, // 閲覧ユーザ自身であるかを示す真偽値
        userId: a.user.userId,
        username: a.user.username
      });
    });

    // 全ユーザ、全候補で二重ループしてそれぞれの出欠の値がない場合には、「欠席」を設定する
    const users = Array.from(userMap.values());
    users.forEach((u) => {
      candidates.forEach((c) => {
        const map = availabilityMapMap.get(u.userId) || new Map();
        const a = map.get(c.candidateId) || 0; // デフォルト値は 0 を使用
        map.set(c.candidateId, a);
        availabilityMapMap.set(u.userId, map);
      });
    });

    // コメント取得
    const comments = await prisma.comment.findMany({
      where: { scheduleId: schedule.scheduleId }
    });
    const commentMap = new Map();  // key: userId, value: comment
    comments.forEach((comment) => {
      commentMap.set(comment.userId, comment.comment);
    });

    res.render('schedule', {
      user: req.user,
      schedule: schedule,
      candidates: candidates,
      users: users,
      availabilityMapMap: availabilityMapMap,
      commentMap: commentMap
    });
  } else {
    const err = new Error('指定された予定は見つかりません');
    err.status = 404;
    next(err);
  }
});

router.get('/:scheduleId/edit', authenticationEnsurer, async (req, res, next) => {
  await param('scheduleId').isUUID('4').run(req);
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    const err = new Error('URL の形式が正しくありません。');
    err.status = 400;
    return next(err);
  }

  const schedule = await prisma.schedule.findUnique({
    where: { scheduleId: req.params.scheduleId }
  });
  if (isMine(req, schedule)) { // 作成者のみが編集フォームを開ける
    const candidates = await prisma.candidate.findMany({
      where: { scheduleId: schedule.scheduleId },
      orderBy: { candidateId: 'asc' }
    });
    res.render('edit', {
      user: req.user,
      schedule: schedule,
      candidates: candidates,
      csrfToken: req.csrfToken()
    });
  } else {
    const err = new Error('指定された予定がない、または、予定する権限がありません');
    err.status = 404;
    next(err);
  }
});

function isMine(req, schedule) {
  return schedule && parseInt(schedule.createdBy) === parseInt(req.user.id);
}

router.post('/:scheduleId/update', authenticationEnsurer, async (req, res, next) => {
  await param('scheduleId').isUUID('4').run(req);
  await body('scheduleName').isString().run(req);
  await body('candidates').isString().run(req);
  await body('memo').isString().run(req);
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    const err = new Error('URL の形式が正しくないか、入力された情報が不十分または正しくありません。');
    err.status = 400;
    return next(err);
  }

  let schedule = await prisma.schedule.findUnique({
    where: { scheduleId: req.params.scheduleId }
  });
  if (isMine(req, schedule)) {
    const updatedAt = new Date();
    schedule = await prisma.schedule.update({
      where: { scheduleId: schedule.scheduleId },
      data: {
        scheduleName: req.body.scheduleName.slice(0, 255) || '（名称未設定）',
        memo: req.body.memo,
        updatedAt: updatedAt
      }
    });
    // 候補が追加されているかチェック
    const candidateNames = parseCandidateNames(req);
    if (candidateNames.length) {
      createCandidatesAndRedirect(candidateNames, schedule.scheduleId, res);
    } else {
      res.redirect('/schedules/' + schedule.scheduleId);
    }
  } else {
    const err = new Error('指定された予定がない、または、編集する権限がありません');
    err.status = 404;
    next(err);
  }
});

router.post('/:scheduleId/delete', authenticationEnsurer, async (req, res, next) => {
  await param('scheduleId').isUUID('4').run(req);
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    const err = new Error('URL の形式が正しくありません。');
    err.status = 400;
    return next(err);
  }

  const schedule = await prisma.schedule.findUnique({
    where: { scheduleId: req.params.scheduleId }
  });
  if (isMine(req, schedule)) {
    await deleteScheduleAggregate(schedule.scheduleId);
    res.redirect('/');
  } else {
    const err = new Error('指定された予定がない、または、削除する権限がありません');
    err.status = 404;
    next(err);
  }
});

async function deleteScheduleAggregate(scheduleId) {
  await prisma.availability.deleteMany({ where: { scheduleId } });
  await prisma.candidate.deleteMany({ where: { scheduleId } });
  await prisma.comment.deleteMany({ where: { scheduleId } });
  await prisma.schedule.delete({ where: { scheduleId } });
}

router.deleteScheduleAggregate = deleteScheduleAggregate;

async function createCandidatesAndRedirect(candidateNames, scheduleId, res) {
  const candidates = candidateNames.map((c) => ({
    candidateName: c,
    scheduleId: scheduleId
  }));
  await prisma.candidate.createMany({
    data: candidates
  });
  res.redirect('/schedules/' + scheduleId);
}

function parseCandidateNames(req) {
  return req.body.candidates.split('\n').map((s) => s.trim()).filter((s) => s !== '');
}

module.exports = router;
