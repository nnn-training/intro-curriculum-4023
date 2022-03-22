'use strict';
const express = require('express');
const router = express.Router();
// /でリクエストがあったときにlogin.pugを読み込むだけだった設定を、リクエストのあったパス(ログインしたかったページ)のクエリを定義し、クエリがあれば、10分間クッキーに保存する設定をしてからログインページを読み込む設定に変更
router.get('/', (req, res, next) => {
  //res.render('login', { user: req.user });
  const from = req.query.from;
  if (from) {
    res.cookie('loginFrom', from, { expires: new Date(Date.now() + 600000)});
  }
  res.render('login');
});

module.exports = router;
