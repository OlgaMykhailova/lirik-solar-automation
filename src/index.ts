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

async function diagnose(): Promise<Response> {
  const token = process.env.BOT_TOKEN!;
  const out: Record<string, string> = {};
  for (const size of [300, 2000, 5000, 11000, 30000]) {
    const form = new FormData();
    form.set("chat_id", "1");
    form.set("document", new Blob([new Uint8Array(size)]), "t.docx");
    const packed = new Response(form);
    const ct = packed.headers.get("content-type") ?? "";
    const body = Buffer.from(await packed.arrayBuffer());
    const t = Date.now();
    try {
      const res = await fetch(`https://api.telegram.org/bot${token}/sendDocument`, {
        method: "POST",
        headers: { "content-type": ct, "content-length": String(body.length) },
        body,
        signal: AbortSignal.timeout(8000),
      });
      out[`${size}B`] = `${Date.now() - t}ms http=${res.status}`;
    } catch (e) {
      out[`${size}B`] = `${Date.now() - t}ms ERR ${e instanceof Error ? e.name : e}`;
    }
  }
  return Response.json(out);
}

export default {
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    if (request.method === "GET" && url.searchParams.get("diag") === process.env.WEBHOOK_SECRET) return diagnose();
    if (request.method !== "POST") return new Response("ok");
    return getHandler()(request);
  },
};
