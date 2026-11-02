import { webhookCallback } from "grammy";
import { createBot, parseAllowedIds } from "./bot/create.js";
import { RedisFileStore } from "./bot/files.js";
import { RedisSessionStore, createRedis } from "./bot/session.js";
import { DOCX_MIME, createUrlDocumentSender } from "./bot/telegram.js";
import { buildSendDocument } from "./drive/delivery.js";
import { RedisCounterStore } from "./data/counters.js";

interface App {
  handler: (req: Request) => Promise<Response>;
  files: RedisFileStore;
}

let app: App | undefined;
let origin = "";

function getApp(): App {
  if (app) return app;
  const token = process.env.BOT_TOKEN;
  const secret = process.env.WEBHOOK_SECRET;
  if (!token || !secret) throw new Error("Не задано BOT_TOKEN або WEBHOOK_SECRET");
  const redis = createRedis();
  const files = new RedisFileStore(redis);
  const urlSender = createUrlDocumentSender(token, files, () => origin);
  const sendDocument = buildSendDocument(token, urlSender);
  const bot = createBot({
    token,
    allowedIds: parseAllowedIds(process.env.ALLOWED_USER_IDS),
    sessions: new RedisSessionStore(redis),
    counters: new RedisCounterStore(redis),
    sendDocument,
  });
  app = { handler: webhookCallback(bot, "std/http", { secretToken: secret, timeoutMilliseconds: 25_000 }), files };
  return app;
}

async function serveFile(url: URL): Promise<Response> {
  const [, , id] = url.pathname.split("/");
  if (!id || !/^[0-9a-f]{32}$/.test(id)) return new Response("not found", { status: 404 });
  const file = await getApp().files.get(id);
  if (!file) return new Response("not found", { status: 404 });
  const filename = (url.searchParams.get("n") ?? "document.docx").replace(/[\r\n"\\/]/g, "_");
  return new Response(new Uint8Array(file), {
    headers: {
      "content-type": DOCX_MIME,
      "content-length": String(file.length),
      "content-disposition": `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
      "cache-control": "no-store",
    },
  });
}

export default {
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    origin = url.origin;
    if ((request.method === "GET" || request.method === "HEAD") && url.pathname.startsWith("/f/")) return serveFile(url);
    if (request.method !== "POST") return new Response("ok");
    return getApp().handler(request);
  },
};
