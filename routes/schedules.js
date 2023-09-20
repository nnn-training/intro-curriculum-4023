const express = require('express');
const router = express.Router();
const { param, body, validationResult } = require('express-validator'); // バリデーション
const ensurer = require('./authentication-ensurer');
const { v4: uuidv4 } = require('uuid');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient({ log: ['query'] });

// day.js
const dayjs = require('dayjs');
const utc = require('dayjs/plugin/utc');
const timezone = require('dayjs/plugin/timezone');
dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.tz.setDefault('Asia/Tokyo');

/* GET schedules listing. */
router.get('/new', ensurer, function (req, res, next) {
  res.render('new', { user: req.user, csrfToken: req.csrfToken()});
});

router.get('/', async function (req, res) {
  /**
   * 予定のデータ
   * @type {{
   *  scheduleId: uuidv4, 
   *  scheduleName: string,
   *  memo: string,
   *  createdBy: string,
   *  updatedAt: data
   * }}
   */
  let schedules;
  schedules = await prisma.schedule.findMany({
    orderBy: { updatedAt: 'desc' }
  });
  schedules.forEach((schedule) => {
    schedule.formattedUpdatedAt = dayjs(schedule.updatedAt).tz().format('YYYY/MM/DD HH:mm');
  });
  res.render('schedules', { schedules: schedules, user: req.user, mime: false });
})
router.get('/mine', async function (req, res) {
  let schedules;
  if (req.user) {
    schedules = await prisma.schedule.findMany({
      where: { createdBy: req.user },
      orderBy: { updatedAt: 'desc' }
    });
  } else {
    return res.redirect('/schedules');
  }
  schedules.forEach((schedule) => {
    schedule.formattedUpdatedAt = dayjs(schedule.updatedAt).tz().format('YYYY/MM/DD HH:mm');
  });
  res.render('schedules', { schedules: schedules, user: req.user, mine: true });
})

router.post('/', ensurer, async function (req, res, next) {
  await body('scheduleName').isString().run(req);
  await body('candidates').isString().run(req);
  await body('memo').isString().run(req);
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return next(val('パラメータが間違っています'));
  }

  console.log(req.body);

  const scheduleId = uuidv4();
  const updateAt = new Date();
  const schedule = await prisma.schedule.create({
    data: {
      scheduleId: scheduleId,
      scheduleName: req.body.scheduleName.slice(0, 255) || '名称未設定', // 文字数制限
      memo: req.body.memo,
      createdBy: req.user,
      updatedAt: updateAt
    }
  });

  await createCanName(req.body.candidates, schedule.scheduleId);
  res.redirect('/schedules/' + schedule.scheduleId);
})

router.get('/:scheduleId', async (req, res, next) => {

  // バリデーション
  await param('scheduleId').isUUID(4).run(req);
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return next(val('予定IDが間違っています'));
  }

  /**
   * 予定のデータ
   * @type {{
   *  scheduleId: uuidv4,
   *  scheduleName: string,
   *  memo: string,
   *  createdBy: string,
   *  updatedAt: data,
   *  user: { userId: string, username: string}
   * }}
   */
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
  })

  if (schedule) { // 予定があるかどうかチェック

    /**
     * 候補のデータ
     * @type {{ candidateId: number, candidateName: string, scheduleId: uuidv4}[]}
     */
    const candidates = await prisma.candidate.findMany({
      where: { scheduleId: schedule.scheduleId },
      orderBy: { candidateId: 'asc' }
    });

    /**
     * 出欠のデータ
     * @type {Array<{user: {userId: string, username: string}}> | undefined}
     */
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
    })

    /**
     * 出欠MapMap
     * key: userId, value: Map(key: candidateId, value: availability)
     * @type {Object.<string, Object.<string,(0 | 1 | 2)>>}
     */
    const availabilityMapMap = new Map();
    availabilities.forEach(ava => {
      const map = availabilityMapMap.get(ava.user.userId) || new Map();
      map.set(ava.candidateId, ava.availability);
      availabilityMapMap.set(ava.user.userId, map)
    });

    /**
     * ユーザ情報のマップ
     * key: userId, value: User
     * @type {Object.<string, {isSelf: boolean, userId: string, username: string}>}
     */
    const userMap = new Map();
    if (req.user) {
      userMap.set(req.user, {
        isSelf: true,
        userId: req.user,
        username: req.user
      });
    }
    availabilities.forEach(a => {
      userMap.set(a.user.userId, {
        isSelf: req.user === a.user.userId, // 地震であるかどうかを示す真偽値
        userId: a.user.userId,
        username: a.user.username
      });
    });
    if (userMap.size === 0) { // そうだった、sizeがあったわ
      userMap.set('', {isSelf: false, userId: 'まだ出欠はありません', username: 'まだ出欠はありません'});
    }

    // 全ユーザ、全候補で二重ループしてそれぞれの出欠の値がない場合には、「欠席」を設定する
    /**
     * ユーザ情報が入った配列
     * @type {{isSelf: boolean, userId: string, username: string}[]}
     */
    const users = Array.from(userMap.values());
    users.forEach((u) => {
      candidates.forEach((c) => {
        const map = availabilityMapMap.get(u.userId) || new Map();
        const a = map.get(c.candidateId) || 0; // デフォルト値は 0 を使用
        map.set(c.candidateId, a);
        availabilityMapMap.set(u.userId, map);
      });
    });

    /**
     * コメントが入った配列
     * @type {{comment: string, scheduleId: uuidv4, userId: string}[]}
     */
    const comments = await prisma.comment.findMany({
      where: { scheduleId: schedule.scheduleId }
    })
    /**
     * コメントが入った連想配列
     * key: ユーザID、value: コメント内容
     * @type {Object.<string,string>}
     */
    const commentMap = new Map();
    comments.forEach(c => {
      commentMap.set(c.userId, c.comment);
    });
    // どうやらコメントは一人一つらしい

    res.render('schedule', {
      schedule: schedule,
      candidates: candidates,
      users: users,
      availabilityMapMap: availabilityMapMap,
      commentMap: commentMap,
      user: req.user
    });

  } else {
    next(val('指定された予定は見つかりません'));
  }
})

router.get('/:scheduleId/edit', ensurer, async function (req, res, next) {

  // バリデーション
  await param('scheduleId').isUUID(4).run(req);
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return next(val('予定IDが間違っています'));
  }

  /**
   * 予定のデータ
   * @type {{
   *  scheduleId: uuidv4, 
   *  scheduleName: string,
   *  memo: string,
   *  createdBy: string,
   *  updatedAt: data
   * }}
   */
  const schedule = await prisma.schedule.findUnique({
    where: { scheduleId: req.params.scheduleId }
  });

  if (isMine(req, schedule)) { // 作成者のみが編集ページを開ける
    /**
     * 候補一覧
     * @type {{ candidateId: number, candidateName: string, scheduleId: uuidv4 }[]}
     */
    const candidates = await prisma.candidate.findMany({
      where: { scheduleId: schedule.scheduleId },
      orderBy: {candidateId: 'asc'}
    })

    res.render('edit', {
      user: req.user,
      schedule: schedule,
      candidates: candidates,
      csrfToken: req.csrfToken()
    })
  } else {
    next(val('指定された予定が見つからないか、予定の編集権限がありません'));
  }
})

router.post('/:scheduleId/update', ensurer, async function (req,res,next) {

  // バリデーション
  await param('scheduleId').isUUID(4).run(req);
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return next(val('予定IDが間違っています'));
  }

  const schedule = await prisma.schedule.findUnique({
    where: {scheduleId: req.params.scheduleId}
  });
  if (isMine(req, schedule)) {
    const updatedAt = new Date();
    await prisma.schedule.update({
      where: {scheduleId: schedule.scheduleId},
      data: {
        scheduleName: req.body.scheduleName.slice(0,255) || '名称未設定',
        memo: req.body.memo,
        updatedAt: updatedAt
      }
    })
    createCanName(req.body.candidates, req.params.scheduleId); // 候補の追加
    res.redirect(`/schedules/${req.params.scheduleId}`);
  } else {
    next(val('予定の編集権限がありません'));
  }
})

router.post('/:scheduleId/delete', ensurer, async function (req, res, next) {

  // バリデーション
  await param('scheduleId').isUUID(4).run(req);
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return next(val('予定IDが間違っています'));
  }

  const schedule = await prisma.schedule.findUnique({
    where: { scheduleId: req.params.scheduleId }
  });
  if (isMine(req, schedule)) {
    // req.bodyは空
    await deleteSchedule(schedule.scheduleId);
    res.redirect('/schedules')
  } else {
    next(val('指定された予定がない、または、削除する権限がありません'));
  }
})

/**
 * 候補の文字列から候補のデータベースを更新する関数
 * @param {req.body.candidates} candidateString 
 * @param {schedule.scheduleId} scheduleId
 * @returns {{candidateName: candidate, scheduleId: scheduleId}[]}
 */
async function createCanName(candidateString, scheduleId) {
  if (!candidateString || !scheduleId) {
    console.log('createCanName: 引数が空またはundefinedです');
    return;
  }
  const Names = candidateString.split('\n').map(s => s.trim()).filter(s => s !== '');
  const candidates =  Names.map((c) => ({
    candidateName: c,
    scheduleId: scheduleId
  }));
  await prisma.candidate.createMany({ data: candidates }); // 更新
  // SQLはテーブル名または列名が大文字の場合は""で囲む必要がある。
  // その場合、WHERE文の値は''で囲む必要がある。
}

/**
 * 予定の作成者が自分かどうか判定する関数
 * @param {Request} req 
 * @param {Schedule} schedule 
 * @returns {boolean}
 */
function isMine(req, schedule) {
  if(schedule) {
    return req.user === schedule.createdBy;
  }
}

/**
 * 予定をデータベースから削除する関数
 * @param {ScheduleId} scheduleId 
 */
async function deleteSchedule(scheduleId) {
  await prisma.availability.deleteMany({ where: { scheduleId } });
  await prisma.candidate.deleteMany({ where: { scheduleId } });
  await prisma.comment.deleteMany({ where: { scheduleId } });
  await prisma.schedule.delete({ where: { scheduleId } });
}

/**
 * エラー作成関数
 * @param {Errors} errors 
 * @param {number} status
 */
function val(errors = '変なリクエスト送るな', status = 404) {
  const err = new Error(errors);
  err.status = status;
  return err;
}

router.deleteSchedule = deleteSchedule; // 公開関数にするらしい
router.val = val;

module.exports = router;