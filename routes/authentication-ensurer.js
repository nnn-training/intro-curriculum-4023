'use strict'

// 認証チェック用の関数らしい。
function ensure(req,res,next) {
    if (req.isAuthenticated()) {
        return next();
    }
    res.redirect('/login');
}

module.exports = ensure;