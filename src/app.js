"use strict";

const { Hono } = require("hono");
const { csrf } = require("hono/csrf");
const { logger } = require("hono/logger");
const { html } = require("hono/html");
const { HTTPException } = require("hono/http-exception");
const { secureHeaders } = require("hono/secure-headers");
const { env } = require("hono/adapter");
const { getCookie, deleteCookie } = require("hono/cookie");
const { serveStatic } = require("@hono/node-server/serve-static");
const { trimTrailingSlash } = require("hono/trailing-slash");
const { githubAuth } = require("@hono/oauth-providers/github"); = require("@hono/oauth-providers/github");
const { getIronSession } = require("iron-session");
const { PrismaClient } = require("@prisma/client");
const layout = require("./layout");

const prisma = new PrismaClient({ log: ["query"] });

const indexRouter = require("./routes/index");
const loginRouter = require("./routes/login");
const logoutRouter = require("./routes/logout");
const scheduleRouter = require("./routes/schedules");
const availabilitiesRouter = require("./routes/availabilities");
const commentsRouter = require("./routes/comments");

const app = new Hono();

app.use(async (c, next) => {
  const { CSRF_TRUSTED_ORIGIN } = env(c);
  const handler = csrf({
    origin: CSRF_TRUSTED_ORIGIN,
  });
  await handler(c, next);
});
app.use(logger());
app.use(serveStatic({ root: "./public" }));
app.use(secureHeaders({
  referrerPolicy: "strict-origin-when-cross-origin",
}));

// セッション管理をするためのミドルウェア
app.use(async (c, next) => {
  const { SESSION_PASSWORD } = env(c);
  const session = await getIronSession(c.req.raw, c.res, {
    password: SESSION_PASSWORD,
    cookieName: "session",
  });
  c.set("session", session);
  await next();
});

// GitHub 認証
app.use("/auth/github", async (c, next) => {
  const { GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET } = env(c);
  const authHandler = githubAuth({
    client_id: GITHUB_CLIENT_ID,
    client_secret: GITHUB_CLIENT_SECRET,
    scope: ["user:email"],
    oauthApp: true,
  });
  return await authHandler(c, next);
});

// GitHub 認証の後の処理
app.get("/auth/github", async (c) => {
  const session = c.get("session");
  session.user = c.get("user-github");
  await session.save();

  // ユーザ情報をデータベースに保存
  const userId = session.user.id;
  const data = {
    userId,
    username: session.user.login,
  };
  await prisma.user.upsert({
    where: { userId },
    update: data,
    create: data,
  });

  const loginFrom = getCookie(c, "loginFrom");
  // オープンリダイレクタ脆弱性対策
  if (loginFrom && loginFrom.startsWith('/')) {
    deleteCookie(c, "loginFrom");
    return c.redirect(loginFrom);
  } else {
    return c.redirect("/");
  }
});

// ルーティング
app.route("/", indexRouter);
app.route("/login", loginRouter);
app.route("/logout", logoutRouter);
app.route("/schedules", scheduleRouter);
app.route("/schedules", availabilitiesRouter);
app.route("/schedules", commentsRouter);

// 404 Not Found
app.notFound((c) => {
  return c.html(
    layout(
      c,
      "Not Found",
      html`
        <h1>Not Found</h1>
        <p>${c.req.url} の内容が見つかりませんでした。</p>
      `,
    ),
    404,
  );
});

// エラーハンドリング
app.onError((error, c) => {
  console.error(error);
  const statusCode = error instanceof HTTPException ? error.status : 500;
  const { NODE_ENV } = env(c);
  return c.html(
    layout(
      c,
      "Error",
      html`
        <h1>Error</h1>
        <h2>${error.name} (${statusCode})</h2>
        <p>${error.message}</p>
        ${NODE_ENV === "development" ? html`<pre>${error.stack}</pre>` : ""}
      `,
    ),
    statusCode,
  );
});

module.exports = app;
