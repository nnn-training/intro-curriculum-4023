// モジュールの読み込み
const createError = require('http-errors');
const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');
const logger = require('morgan');
const helmet = require('helmet');
const session = require('express-session');
const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const csurf = require('tiny-csrf');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient({ log: ['query'] })

const app = express();

// ルーターの読み込み
const indexRouter = require('./routes/index');
const usersRouter = require('./routes/users');
const loginRouter = require('./routes/login');
const logoutRouter = require('./routes/logout');
const shedRouter = require('./routes/schedules');
const availRouter = require('./routes/availabilities');
const commentsRouter = require('./routes/comments');

app.use(helmet());

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'pug');

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser('nyobiko_signed_cookies'));
app.use(express.static(path.join(__dirname, 'public')));

// csrf対策
app.use(
  csurf(
    'nyobikosecretsecret9876543212345',
    ['POST'],
    [/.*\/(candidates|comments|login\/auth).*/i] 
  )
);

// express-session
app.use(session ({
  secret: 'mysecret',
  resave: false,
  saveUninitialized:false,
}))

//passport　初期設定
app.use(passport.initialize());
app.use(passport.session());

// ルーター一覧
app.use('/', indexRouter);
app.use('/users', usersRouter);
app.use('/login', loginRouter);
app.use('/logout', logoutRouter);
app.use('/schedules', shedRouter);
app.use('/schedules', availRouter);
app.use('/schedules', commentsRouter);

// ユーザーデータ
const USER_DATA = [
  {username: 'alice', password: 'alice'},
  {username: 'Taro', password: 'Taro123'},
  {username: 'admin', password: 'apple'}
];

passport.use(new LocalStrategy(
  (username, password, cb) => {
    const user = USER_DATA.find(e => username === e.username);
    if (user){
      if (password === user.password) {
        return cb(null, username);
      } else {
        console.log('パスワードのチェックに失敗');
        return cb(null, false);
      }
    } else {
      console.log('ユーザーネームのチェックに失敗');
      return cb(null, false);
    }
  }
));

// ユーザーデータからユニークユーザー識別子を取り出す
passport.serializeUser( (username, cb) => {
  cb(null, username);
});

passport.deserializeUser( (username, cb) => {
  return cb(null, username);
})

app.post('/login/auth',
  passport.authenticate('local', {
    failureRedirect: '/login', // 認証失敗した場合の飛び先
    failureFlash: false
  }),
  async (req,res) => {
    console.log('認証成功');

    // データベースの処理
    const data = {username: req.user, userId: req.user};
    await prisma.user.upsert({
      where: { userId: data.username },
      create: data,
      update: data
    })

    res.redirect('/');
  }
)

// catch 404 and forward to error handler
app.use(function(req, res, next) {
  next(createError(404));
});

// error handler
app.use(function(err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  // render the error page
  res.status(err.status || 500);
  res.render('error');
});

module.exports = app;
