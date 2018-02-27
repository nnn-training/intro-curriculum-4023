var express = require('express');
var path = require('path');
var favicon = require('serve-favicon');
var logger = require('morgan');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');
var helmet = require('helmet');
var session = require('express-session');
var passport = require('passport');

// モデルの読み込み
var User = require('./models/user');
var Schedule = require('./models/schedule');
var Availability = require('./models/availability');
var Candidate = require('./models/candidate');
var Comment = require('./models/comment');
User.sync().then(() => {
    Schedule.belongsTo(User, { foreignKey: 'createdBy' });
    Schedule.sync();
    Comment.belongsTo(User, { foreignKey: 'userId' });
    Comment.sync();
    Availability.belongsTo(User, { foreignKey: 'userId' });
    Candidate.sync().then(() => {
        Availability.belongsTo(Candidate, { foreignKey: 'candidateId' });
        Availability.sync();
    });
});

var GitHubStrategy = require('passport-github2').Strategy;
var GITHUB_CLIENT_ID = process.env.GITHUB_CLIENT_ID || '2f831cb3d4aac02393aa';
var GITHUB_CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET || '9fbc340ac0175123695d2dedfbdf5a78df3b8067';

passport.serializeUser(function(user, done) {
    done(null, user);
});

passport.deserializeUser(function(obj, done) {
    done(null, obj);
});


passport.use(new GitHubStrategy({
        clientID: GITHUB_CLIENT_ID,
        clientSecret: GITHUB_CLIENT_SECRET,
        callbackURL: process.env.HEROKU_URL ? process.env.HEROKU_URL + 'auth/github/callback' : 'http://localhost:8000/auth/github/callback'
    },
    function(accessToken, refreshToken, profile, done) {
        process.nextTick(function() {
            User.upsert({
                userId: profile.id,
                username: profile.username
            }).then(() => {
                done(null, profile);
            });
        });
    }
));

var routes = require('./routes/index');
var login = require('./routes/login');
var logout = require('./routes/logout');
var schedules = require('./routes/schedules');
var availabilities = require('./routes/availabilities');
var comments = require('./routes/comments');

var app = express();
app.use(helmet());

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'pug');

// uncomment after placing your favicon in /public
//app.use(favicon(path.join(__dirname, 'public', 'favicon.ico')));
app.use(logger('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

app.use(session({ secret: 'e55be81b307c1c09', resave: false, saveUninitialized: false }));
app.use(passport.initialize());
app.use(passport.session());

app.use('/', routes);
app.use('/login', login);
app.use('/logout', logout);
app.use('/schedules', schedules);
app.use('/schedules', availabilities);
app.use('/schedules', comments);

app.get('/auth/github',
    passport.authenticate('github', { scope: ['user:email'] }),
    function(req, res) {});

app.get('/auth/github/callback',
    passport.authenticate('github', { failureRedirect: '/login' }),
    function(req, res) {
        var loginFrom = req.cookies.loginFrom;
        // オープンリダイレクタ脆弱性対策
        if (loginFrom &&
            loginFrom.indexOf('http://') < 0 &&
            loginFrom.indexOf('https://') < 0) {
            res.clearCookie('loginFrom');
            res.redirect(loginFrom);
        } else {
            res.redirect('/');
        }
    });

// catch 404 and forward to error handler
app.use(function(req, res, next) {
    var err = new Error('Not Found');
    err.status = 404;
    next(err);
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