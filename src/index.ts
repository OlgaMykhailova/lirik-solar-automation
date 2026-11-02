import { webhookCallback } from "grammy";
import { createBot, parseAllowedIds } from "./bot/create.js";
import { RedisSessionStore, createRedis } from "./bot/session.js";
import { RedisCounterStore } from "./data/counters.js";

let handler: ((req: Request) => Promise<Response>) | undefined;

function getHandler() {
  if (handler) return handler;
  const token = process.env.BOT_TOKEN;
  const secret = process.env.WEBHOOK_SECRET;
  if (!token || !secret) throw new Error("Не задано BOT_TOKEN або WEBHOOK_SECRET");
  const redis = createRedis();
  const bot = createBot({
    token,
    allowedIds: parseAllowedIds(process.env.ALLOWED_USER_IDS),
    sessions: new RedisSessionStore(redis),
    counters: new RedisCounterStore(redis),
  });
  handler = webhookCallback(bot, "std/http", { secretToken: secret, timeoutMilliseconds: 25_000 });
  return handler;
}

export default {
  async fetch(request: Request): Promise<Response> {
    if (request.method !== "POST") return new Response("ok");
    return getHandler()(request);
  },
};
