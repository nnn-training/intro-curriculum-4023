const { Hono } = require("hono");
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient({ log: ["query"] });
const ensureAuthenticated = require("../middlewares/ensure-authenticated");
const { z } = require("zod");
const { zValidator } = require("@hono/zod-validator");

const app = new Hono();

const paramValidator = zValidator(
  "param",
  z.object({
    scheduleId: z.string().uuid(),
    userId: z.coerce.number().int().min(0),
  }),
  (result, c) => {
    if (!result.success) {
      return c.json({
        status: "NG",
        errors: [result.error],
      }, 400);
    }
  }
);

const jsonValidator = zValidator(
  "json",
  z.object({
    comment: z.string().min(1).max(255),
  }),
  (result, c) => {
    if (!result.success) {
      return c.json({
        status: "NG",
        errors: [result.error],
      }, 400);
    }
  }
);

app.post(
  "/:scheduleId/users/:userId/comments",
  ensureAuthenticated(),
  paramValidator,
  jsonValidator, 
  async (c) => {
    const { scheduleId, userId } = c.req.valid("param");
    const { comment } = c.req.valid("json");

    const { user } = c.get("session") ?? {};

    await prisma.comment.upsert({
        where: {
          commentCompositeId: {
            userId,
            scheduleId,
          },
        },
        update: data,
        create: data,
      });
    } catch (error) {
      console.error(error);
      return c.json({ 
        status: "NG",
        errors: [{ msg: "データベース エラー。" }],
      }, 500);
    }

    return c.json({ status: "OK", comment });
  },
);

module.exports = app;
