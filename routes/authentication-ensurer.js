'use strict';

function ensure(req, res, next) {
  if (req.isAuthenticated()) { return next(); }
  //res.redirect('/login');を以下に変更
  //その時アクセスしようとしていたパスのクエリ以下を、/loginにアクセスする時のパスに含めてリダイレクトする
  res.redirect('/login?from=' + req.originalUrl);
}

module.exports = ensure;
