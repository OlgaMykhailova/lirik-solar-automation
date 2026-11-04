import { describe, expect, it, vi } from "vitest";
import { createBot } from "../src/bot/create.js";
import type { Session, SessionStore } from "../src/bot/session.js";
import { MemoryCounterStore, type CounterStore } from "../src/data/counters.js";

class MemorySessions implements SessionStore {
  m = new Map<number, Session>();
  seen = new Set<number>();
  async get(id: number) { return this.m.get(id) ?? null; }
  async set(id: number, s: Session) { this.m.set(id, structuredClone(s)); }
  async clear(id: number) { this.m.delete(id); }
  async seenUpdate(id: number) { const r = this.seen.has(id); this.seen.add(id); return r; }
}

async function setup(counters: CounterStore = new MemoryCounterStore(), beforeSend?: (chatId: number, file: Buffer, filename: string) => Promise<void>) {
  const calls: { method: string; payload: any }[] = [];
  const bot = createBot({
    token: "123:abc",
    allowedIds: [1],
    sessions: new MemorySessions(),
    counters,
    sendDocument: async (chatId, file, filename, caption) => {
      await beforeSend?.(chatId, file, filename);
      calls.push({ method: "sendDocument", payload: { chat_id: chatId, size: file.length, filename, caption } });
    },
  });
  bot.api.config.use(async (_prev, method, payload) => {
    calls.push({ method, payload });
    if (method === "getMe") return { ok: true, result: { id: 9, is_bot: true, first_name: "b", username: "b" } } as any;
    return { ok: true, result: { message_id: 1, date: 0, chat: { id: 1, type: "private" } } } as any;
  });
  await bot.init();
  let uid = 0;
  const chat = { id: 1, type: "private" as const };
  const from = { id: 1, is_bot: false, first_name: "u" };
  const text = (t: string, f = from) => bot.handleUpdate({ update_id: ++uid, message: { message_id: uid, date: 0, chat, from: f, text: t, ...(t.startsWith("/") ? { entities: [{ type: "bot_command", offset: 0, length: t.length }] } : {}) } } as any);
  const click = (data: string) => bot.handleUpdate({ update_id: ++uid, callback_query: { id: String(uid), from, chat_instance: "x", data, message: { message_id: 1, date: 0, chat } } } as any);
  return { calls, text, click, bot };
}

async function makeDoc(h: Awaited<ReturnType<typeof setup>>, kind: "invoice" | "waybill", fop: string, warranty = false) {
  await h.text("/start");
  await h.click(`doc:${kind}`);
  await h.click(`fop:${fop}`);
  await h.text("Інвертор Deye");
  await h.text("1");
  await h.text("1150");
  await h.click("more:add");
  await h.text("Батарея Deye");
  await h.text("4");
  await h.text("1 100,50");
  await h.click("more:next");
  await h.text("41,5");
  if (kind === "waybill") await h.click(warranty ? "warranty:yes" : "warranty:no");
  await h.click("gen");
}

describe("діалог бота", () => {
  it("проходить увесь шлях і надсилає документ з номером 10, далі 11", async () => {
    const h = await setup();
    await makeDoc(h, "invoice", "drizhenko");
    let docs = h.calls.filter((c) => c.method === "sendDocument");
    expect(docs).toHaveLength(1);
    expect(docs[0]!.payload.caption).toMatch(/^№ \d\d-\d\d-10$/);
    const summary = h.calls.filter((c) => c.method === "sendMessage").map((c) => c.payload.text).find((t: string) => t.startsWith("Документ:"));
    expect(summary).toContain("Разом: 230 408,00 грн");
    await makeDoc(h, "invoice", "drizhenko");
    docs = h.calls.filter((c) => c.method === "sendDocument");
    expect(docs[1]!.payload.caption).toMatch(/-11$/);
    await makeDoc(h, "waybill", "drizhenko");
    docs = h.calls.filter((c) => c.method === "sendDocument");
    expect(docs[2]!.payload.caption).toMatch(/-10$/);
  });

  it("відхиляє некоректний ввід і повторний клік не дублює документ", async () => {
    const h = await setup();
    await h.text("/start");
    await h.click("doc:waybill");
    await h.click("fop:neskhodovskyi");
    await h.text("Товар");
    await h.text("abc");
    await h.text("1");
    await h.text("12,345");
    await h.text("10");
    await h.click("more:next");
    await h.text("0");
    await h.text("40");
    await h.click("warranty:no");
    await h.click("gen");
    await h.click("gen");
    const msgs = h.calls.filter((c) => c.method === "sendMessage").map((c) => c.payload.text as string);
    expect(msgs.some((m) => m.startsWith("Введіть кількість"))).toBe(true);
    expect(msgs.some((m) => m.startsWith("Введіть ціну"))).toBe(true);
    expect(msgs.some((m) => m.startsWith("Введіть курс"))).toBe(true);
    expect(h.calls.filter((c) => c.method === "sendDocument")).toHaveLength(1);
  });

  it("не використовує webhook reply (інакше Vercel обриває обробку)", async () => {
    const h = await setup();
    // clientConfig приватна в типах grammY, але саме вона вирішує, чи йде перший API-виклик як відповідь на вебхук
    expect((h.bot as any).clientConfig.canUseWebhookReply("answerCallbackQuery")).toBe(false);
  });

  it("при збої не кидає помилку (інакше вебхук дає 500), а відповідає в чат", async () => {
    const h = await setup({ next: async () => { throw new Error("redis недоступний"); } });
    await expect(makeDoc(h, "invoice", "drizhenko")).resolves.toBeUndefined();
    const msgs = h.calls.filter((c) => c.method === "sendMessage").map((c) => c.payload.text as string);
    expect(msgs.some((m) => m.startsWith("Сталася помилка: redis недоступний"))).toBe(true);
    expect(h.calls.some((c) => c.method === "sendDocument")).toBe(false);
  });

  const docs = (h: Awaited<ReturnType<typeof setup>>) => h.calls.filter((c) => c.method === "sendDocument").map((c) => c.payload);
  const texts = (h: Awaited<ReturnType<typeof setup>>) => h.calls.filter((c) => c.method === "sendMessage").map((c) => c.payload.text as string);

  it("накладна питає про гарантійний талон, а рахунок ні", async () => {
    const h = await setup();
    await makeDoc(h, "invoice", "drizhenko");
    expect(texts(h).some((t) => t.includes("гарантійний талон"))).toBe(false);
    const w = await setup();
    await makeDoc(w, "waybill", "drizhenko", false);
    const ask = w.calls.find((c) => c.payload.text === "Генерувати гарантійний талон?")!;
    expect(ask.payload.reply_markup.inline_keyboard[0].map((b: any) => b.text)).toEqual(["Так", "Ні"]);
  });

  it("відповідь «Ні» дає лише накладну", async () => {
    const h = await setup();
    await makeDoc(h, "waybill", "drizhenko", false);
    expect(docs(h).map((d) => d.filename.split(" ")[0])).toEqual(["Видаткова"]);
    expect(texts(h).some((t) => t.includes("Гарантійний талон: ні"))).toBe(true);
  });

  it("відповідь «Так» дає накладну й гарантійний талон з окремою нумерацією", async () => {
    const h = await setup();
    await makeDoc(h, "waybill", "drizhenko", true);
    expect(texts(h).some((t) => t.includes("Гарантійний талон: так"))).toBe(true);
    const [waybill, warranty] = docs(h);
    expect(waybill.filename).toMatch(/^Видаткова накладна \d\d-\d\d-10 Дриженко Р\.В\.docx$/);
    expect(warranty.filename).toMatch(/^Гарантійний талон \d\d-\d\d-10 Дриженко Р\.В\.docx$/);
    expect(waybill.caption).toBe(warranty.caption);
    expect(warranty.size).toBeGreaterThan(10_000);
    await makeDoc(h, "waybill", "drizhenko", true);
    const all = docs(h);
    expect(all.map((d) => d.caption.split("-").pop())).toEqual(["10", "10", "11", "11"]);
    await makeDoc(h, "waybill", "neskhodovskyi", true);
    expect(docs(h).slice(4).map((d) => d.caption.split("-").pop())).toEqual(["10", "10"]);
  });

  it("якщо талон не вдалося створити, накладна вже надіслана, а користувач бачить причину", async () => {
    const h = await setup(undefined, async (_c, _f, filename) => { if (filename.startsWith("Гарантійний")) throw new Error("диск недоступний"); });
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    await makeDoc(h, "waybill", "drizhenko", true);
    expect(docs(h).map((d) => d.filename.split(" ")[0])).toEqual(["Видаткова"]);
    expect(texts(h).some((t) => t.startsWith("Накладну надіслано, але гарантійний талон не вдалося створити: диск недоступний"))).toBe(true);
    expect(texts(h).some((t) => t.startsWith("Готово"))).toBe(true);
  });

  it("не пускає сторонніх", async () => {
    const h = await setup();
    await h.text("/start", { id: 2, is_bot: false, first_name: "x" });
    expect(h.calls.map((c) => c.payload?.text)).toContain("Доступ закрито.");
    expect(h.calls.some((c) => c.method === "sendDocument")).toBe(false);
  });
});
