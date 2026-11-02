import { afterEach, describe, expect, it, vi } from "vitest";
import { AppsScriptDrive } from "../src/drive/appsscript.js";
import { buildSendDocument } from "../src/drive/delivery.js";
import { createDriveDocumentSender } from "../src/drive/sender.js";

afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

const URL_ = "https://script.google.com/macros/s/AKfy/exec";

type Call = { url: string; init: any };
function stub(reply: (c: Call) => { status?: number; text: string } | Error) {
  const calls: Call[] = [];
  vi.stubGlobal("fetch", async (url: string, init: any = {}) => {
    const c = { url, init };
    calls.push(c);
    const r = reply(c);
    if (r instanceof Error) throw r;
    const status = r.status ?? 200;
    return { ok: status < 400, status, text: async () => r.text, json: async () => JSON.parse(r.text) };
  });
  return calls;
}

const okReply = (c: Call) =>
  c.url === URL_
    ? { text: JSON.stringify({ ok: true, id: "FILE1", url: "https://drive.google.com/file/d/FILE1/view?usp=drivesdk" }) }
    : { text: JSON.stringify({ ok: true }) };

describe("AppsScriptDrive", () => {
  it("надсилає секрет, назву й base64 і повертає посилання", async () => {
    const calls = stub(okReply);
    const up = await new AppsScriptDrive(URL_, "sec").uploadDocument(Buffer.from("DOCX-БАЙТИ"), "Рахунок 02-11-10.docx");
    expect(up).toEqual({ id: "FILE1", viewUrl: "https://drive.google.com/file/d/FILE1/view?usp=drivesdk", downloadUrl: "https://drive.google.com/uc?export=download&id=FILE1" });
    expect(calls[0]!.init.method).toBe("POST");
    const body = JSON.parse(calls[0]!.init.body);
    expect(body).toMatchObject({ secret: "sec", name: "Рахунок 02-11-10.docx" });
    expect(Buffer.from(body.data, "base64").toString()).toBe("DOCX-БАЙТИ");
  });

  it("повідомляє помилку скрипта (наприклад, неправильний секрет)", async () => {
    stub(() => ({ text: JSON.stringify({ ok: false, error: "forbidden" }) }));
    await expect(new AppsScriptDrive(URL_, "bad").uploadDocument(Buffer.from("x"), "a.docx")).rejects.toThrow("скрипт Google: forbidden");
  });

  it("підказує, що не так, коли замість JSON прийшла HTML-сторінка", async () => {
    stub(() => ({ status: 200, text: "<html><body>Sign in – Google Accounts</body></html>" }));
    await expect(new AppsScriptDrive(URL_, "s").uploadDocument(Buffer.from("x"), "a.docx")).rejects.toThrow(/не JSON.*Anyone.*Sign in/s);
  });

  it("називає тайм-аут і мережеву помилку", async () => {
    stub(() => Object.assign(new Error("aborted"), { name: "TimeoutError" }));
    await expect(new AppsScriptDrive(URL_, "s").uploadDocument(Buffer.from("x"), "a.docx")).rejects.toThrow(/скрипт Google не відповів за \d+ с/);
    stub(() => new Error("getaddrinfo ENOTFOUND"));
    await expect(new AppsScriptDrive(URL_, "s").uploadDocument(Buffer.from("x"), "a.docx")).rejects.toThrow(/недоступний: getaddrinfo/);
  });
});

describe("відправник через Диск", () => {
  const uploader = { uploadDocument: async () => ({ id: "F", viewUrl: "https://v", downloadUrl: "https://d" }) };

  it("надсилає в чат кнопки Відкрити/Завантажити", async () => {
    const calls = stub(() => ({ text: JSON.stringify({ ok: true }) }));
    const fallback = vi.fn();
    await createDriveDocumentSender("T", uploader, fallback)(42, Buffer.from("x"), "a.docx", "№ 02-11-10");
    const payload = JSON.parse(calls[0]!.init.body);
    expect(calls[0]!.url).toBe("https://api.telegram.org/botT/sendMessage");
    expect(payload).toMatchObject({ chat_id: 42, text: "№ 02-11-10\na.docx" });
    expect(payload.reply_markup.inline_keyboard[0]).toEqual([{ text: "Відкрити", url: "https://v" }, { text: "Завантажити", url: "https://d" }]);
    expect(fallback).not.toHaveBeenCalled();
  });

  it("при збої Диска переходить на запасну доставку з поясненням", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const fallback = vi.fn(async () => undefined);
    const failing = { uploadDocument: async () => { throw new Error("скрипт Google: forbidden"); } };
    await createDriveDocumentSender("T", failing, fallback)(42, Buffer.from("x"), "a.docx", "№ 1");
    expect(fallback).toHaveBeenCalledWith(42, expect.any(Buffer), "a.docx", "№ 1\nGoogle Диск не спрацював: скрипт Google: forbidden");
  });
});

describe("вибір способу доставки", () => {
  const buf = Buffer.from("x");

  it("без змінних використовує запасну доставку й називає відсутню", async () => {
    const fallback = vi.fn(async () => undefined);
    await buildSendDocument("T", fallback, {})(1, buf, "a.docx", "№ 1");
    expect(fallback).toHaveBeenCalledWith(1, buf, "a.docx", "№ 1\nGoogle Диск не налаштований: немає змінної GOOGLE_SCRIPT_URL, GOOGLE_SCRIPT_SECRET");
    await buildSendDocument("T", fallback, { GOOGLE_SCRIPT_URL: "u" })(1, buf, "a.docx", "№ 1");
    expect(fallback).toHaveBeenLastCalledWith(1, buf, "a.docx", expect.stringContaining("немає змінної GOOGLE_SCRIPT_SECRET"));
  });

  it("із змінними надсилає через Диск, а не запасним шляхом", async () => {
    const calls = stub((c) => (c.url === URL_ ? okReply(c) : { text: "{}" }));
    const fallback = vi.fn(async () => undefined);
    await buildSendDocument("T", fallback, { GOOGLE_SCRIPT_URL: ` ${URL_}\n`, GOOGLE_SCRIPT_SECRET: "sec " })(1, buf, "a.docx", "№ 1");
    expect(fallback).not.toHaveBeenCalled();
    expect(calls.map((c) => c.url)).toEqual([URL_, "https://api.telegram.org/botT/sendMessage"]);
  });
});
