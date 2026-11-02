import { Bot, InlineKeyboard, InputFile, type Context } from "grammy";
import type { CounterStore } from "../data/counters.js";
import { nextDocNumber } from "../data/counters.js";
import { FOPS } from "../data/fop.js";
import { generateInvoice } from "../generators/invoice.js";
import { generateWaybill } from "../generators/waybill.js";
import type { DocData, DocType, FopId } from "../types.js";
import { formatKop, parseQty, priceInKop, priceItems, totalKop } from "../utils/money.js";
import type { Session, SessionStore } from "./session.js";

const DOC_LABEL: Record<DocType, string> = { invoice: "рахунок", waybill: "накладну" };

const mainMenu = () =>
  new InlineKeyboard().text("Згенерувати рахунок", "doc:invoice").row().text("Згенерувати накладну", "doc:waybill");
const fopMenu = () =>
  new InlineKeyboard()
    .text(FOPS.neskhodovskyi.buttonLabel, "fop:neskhodovskyi")
    .row()
    .text(FOPS.drizhenko.buttonLabel, "fop:drizhenko")
    .row()
    .text("Скасувати", "cancel");
const cancelOnly = () => new InlineKeyboard().text("Скасувати", "cancel");
const moreMenu = () =>
  new InlineKeyboard().text("+ Додати товар", "more:add").text("Далі", "more:next").row().text("Скасувати", "cancel");
const confirmMenu = () => new InlineKeyboard().text("Згенерувати", "gen").text("Скасувати", "cancel");

export interface Deps {
  token: string;
  allowedIds: number[];
  sessions: SessionStore;
  counters: CounterStore;
}

export function parseAllowedIds(raw: string | undefined): number[] {
  return (raw ?? "")
    .split(",")
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isInteger(n) && n > 0);
}

function summary(s: Session): string {
  const items = priceItems(s.items, s.rate ?? "0");
  const lines = items.map(
    (it, i) => `${i + 1}. ${it.name}\n   ${it.qty} шт × ${formatKop(it.priceKop)} = ${formatKop(it.sumKop)} грн`,
  );
  const fop = FOPS[s.fopId];
  return [
    `Документ: ${s.docType === "invoice" ? "рахунок на оплату" : "видаткова накладна"}`,
    `${fop.buttonLabel}, курс ${s.rate}`,
    "",
    ...lines,
    "",
    `Разом: ${formatKop(totalKop(items))} грн`,
  ].join("\n");
}

export function createBot({ token, allowedIds, sessions, counters }: Deps): Bot {
  // Без цього перший API-виклик іде як відповідь на вебхук, Vercel завершує запит
  // і може зупинити функцію до закінчення генерації документа.
  const bot = new Bot(token, { client: { canUseWebhookReply: () => false } });

  bot.catch(async (err) => {
    console.error("Помилка обробки оновлення:", err.error);
    try {
      await err.ctx.reply("Сталася помилка. Спробуйте ще раз: /start");
    } catch {
      // нічого: користувач міг заблокувати бота
    }
  });

  bot.use(async (ctx, next) => {
    const id = ctx.from?.id;
    if (!id || !allowedIds.includes(id)) {
      if (ctx.chat) await ctx.reply("Доступ закрито.");
      return;
    }
    if (await sessions.seenUpdate(ctx.update.update_id)) return;
    await next();
  });

  const start = async (ctx: Context) => {
    if (ctx.from) await sessions.clear(ctx.from.id);
    await ctx.reply("Що згенерувати?", { reply_markup: mainMenu() });
  };
  bot.command("start", start);
  bot.command("cancel", start);

  bot.callbackQuery("cancel", async (ctx) => {
    await ctx.answerCallbackQuery();
    await sessions.clear(ctx.from.id);
    await ctx.reply("Скасовано.", { reply_markup: mainMenu() });
  });

  bot.callbackQuery(/^doc:(invoice|waybill)$/, async (ctx) => {
    await ctx.answerCallbackQuery();
    const docType = ctx.match[1] as DocType;
    await sessions.set(ctx.from.id, { step: "name", docType, fopId: "neskhodovskyi", items: [] });
    await ctx.reply(`Оберіть ФОП для документа (${DOC_LABEL[docType]}):`, { reply_markup: fopMenu() });
  });

  bot.callbackQuery(/^fop:(neskhodovskyi|drizhenko)$/, async (ctx) => {
    await ctx.answerCallbackQuery();
    const s = await sessions.get(ctx.from.id);
    if (!s) return ctx.reply("Сесія застаріла.", { reply_markup: mainMenu() });
    s.fopId = ctx.match[1] as FopId;
    s.step = "name";
    await sessions.set(ctx.from.id, s);
    await ctx.reply("Назва товару №1:", { reply_markup: cancelOnly() });
  });

  bot.callbackQuery(/^more:(add|next)$/, async (ctx) => {
    await ctx.answerCallbackQuery();
    const s = await sessions.get(ctx.from.id);
    if (!s || s.step !== "more") return;
    if (ctx.match[1] === "add") {
      s.step = "name";
      await sessions.set(ctx.from.id, s);
      await ctx.reply(`Назва товару №${s.items.length + 1}:`, { reply_markup: cancelOnly() });
    } else {
      s.step = "rate";
      await sessions.set(ctx.from.id, s);
      await ctx.reply("Курс USD → UAH (наприклад 41.5):", { reply_markup: cancelOnly() });
    }
  });

  bot.callbackQuery("gen", async (ctx) => {
    await ctx.answerCallbackQuery();
    const s = await sessions.get(ctx.from.id);
    if (!s || s.step !== "confirm" || !s.rate) return ctx.reply("Нічого генерувати. /start");
    // видаляємо сесію до генерації, щоб подвійний клік не створив дубль
    await sessions.clear(ctx.from.id);
    const fop = FOPS[s.fopId];
    const date = new Date();
    const number = await nextDocNumber(counters, s.fopId, s.docType, date);
    const data: DocData = { fop, number, date, items: priceItems(s.items, s.rate) };
    const buffer = s.docType === "invoice" ? await generateInvoice(data) : await generateWaybill(data);
    const filename = `${s.docType === "invoice" ? "Рахунок на оплату" : "Видаткова накладна"} ${number} ${fop.signature}.docx`;
    await ctx.replyWithDocument(new InputFile(buffer, filename), { caption: `№ ${number}` });
    await ctx.reply("Готово. Що далі?", { reply_markup: mainMenu() });
  });

  bot.on("message:text", async (ctx) => {
    const s = await sessions.get(ctx.from.id);
    const text = ctx.message.text.trim();
    if (!s) return ctx.reply("Оберіть дію:", { reply_markup: mainMenu() });

    switch (s.step) {
      case "name": {
        if (!text) return ctx.reply("Введіть назву товару:");
        s.draftName = text;
        s.step = "qty";
        await sessions.set(ctx.from.id, s);
        return ctx.reply("Кількість, шт:", { reply_markup: cancelOnly() });
      }
      case "qty": {
        const qty = parseQty(text);
        if (qty === null) return ctx.reply("Введіть кількість цілим числом, наприклад 2:");
        s.draftQty = qty;
        s.step = "price";
        await sessions.set(ctx.from.id, s);
        return ctx.reply("Ціна за одиницю в USD:", { reply_markup: cancelOnly() });
      }
      case "price": {
        if (priceInKop(text, "1") === null) return ctx.reply("Введіть ціну числом (до 2 знаків після коми), наприклад 1150 або 1150,50:");
        s.items.push({ name: s.draftName ?? "", qty: s.draftQty ?? 1, priceUsd: text });
        delete s.draftName;
        delete s.draftQty;
        s.step = "more";
        await sessions.set(ctx.from.id, s);
        return ctx.reply(`Додано товарів: ${s.items.length}. Що далі?`, { reply_markup: moreMenu() });
      }
      case "rate": {
        if (priceInKop("1", text) === null) return ctx.reply("Введіть курс числом (до 4 знаків після коми), наприклад 41.5:");
        s.rate = text;
        s.step = "confirm";
        await sessions.set(ctx.from.id, s);
        return ctx.reply(summary(s), { reply_markup: confirmMenu() });
      }
      default:
        return ctx.reply("Скористайтеся кнопками під повідомленням або /cancel.");
    }
  });

  return bot;
}
