'use strict';
const express = require('express');
const router = express.Router();
const Schedule = require('../models/schedule');
//予定名からデータを抽出する際に必要なため、sequelizeモジュールを読み込み
const { Op } = require('sequelize');

const dayjs = require('dayjs');
const utc = require('dayjs/plugin/utc');
const timezone = require('dayjs/plugin/timezone');
dayjs.extend(utc);
dayjs.extend(timezone);

/* GET home page. */
router.get('/', (req, res, next) => {
  const title = '晩ごはん🍚 食べる？';
  if (req.user) {
    Schedule.findAll({
      where: {
        createdBy: req.user.id
      },
      order: [['updatedAt', 'DESC']]
    }).then((schedules) => {
      schedules.forEach((schedule) => {
        schedule.formattedUpdatedAt = dayjs(schedule.updatedAt).tz('Asia/Tokyo').format('YYYY/MM/DD HH:mm');
      });
      res.render('index', {
        title: title,
        user: req.user,
        schedules: schedules
      });
    });
  } else {
    res.render('index', { title: title, user: req.user });
  }
});
//インデックスページから予定のリンクを表示するために、日付で検索できるように以下を追加してみる
//以下で現在の月だけ取り出す（例：３月）
let now = new Date();
let month = new Intl.DateTimeFormat('jp', { month: "numeric" }).format(now);
//今の日付に1ヶ月足し、その月を取り出す（例：４月）
let next = now.setMonth(now.getMonth() + 1);
let next_month = new Intl.DateTimeFormat('jp', { month: "numeric" }).format(next);
router.get('/this_month', (req, res, next) => {
  //全ての予定から、予定名に今だと「3月」が入っているものを取り出す
  Schedule.findAll({
    where: {
      scheduleName: {
        [Op.like]: `${month}%`
      }
    }
  }).then((schedules) => {
    res.render('this_month', {
      schedules: schedules
    })
  })
});
router.get('/next_month', (req, res, next) => {
  //全ての予定から、予定名に今だと「4月」が入っているものを取り出す
  Schedule.findAll({
    where: {
      scheduleName: {
        [Op.like]: `${next_month}%`
      }
    }
  }).then((schedules) => {
    res.render('next_month', {
      schedules: schedules
    })
  })
});
module.exports = router;
