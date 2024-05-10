const { Hono } = require("hono");
const ensureAuthenticated = require("../middlewares/ensure-authenticated");
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient({ log: ["query"] });
const { z } = require("zod");
const { zValidator } = require("@hono/zod-validator");

const app = new Hono();

const paramValidator = zValidator(
  "param",
  z.object({
    scheduleId: z.string().uuid(),
    userId: z.coerce.number().int().min(0),
    candidateId: z.coerce.number().int().min(0),
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
    availability: z.number().int().min(0).max(2),
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
  "/:scheduleId/users/:userId/candidates/:candidateId", 
  ensureAuthenticated(),
  paramValidator, 
  jsonValidator, 
  async (c) => {
    const { scheduleId, userId, candidateId } = c.req.valid("param");
    const { availability } = c.req.valid("json");

    const { user } = c.get("session") ?? {};

    await prisma.availability.upsert({
        where: {
          availabilityCompositeId: {
            candidateId,
            userId,
          },
        },
        create: data,
        update: data,
      });
    } catch (error) {
      console.error(error);
      return c.json({
        status: "NG",
        errors: [
          { msg: "データベース エラー。" }
        ],
      }, 500);
    }

    return c.json({ status: "OK", availability });
  }
);

module.exports = app;
