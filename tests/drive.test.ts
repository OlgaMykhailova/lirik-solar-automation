import { afterEach, describe, expect, it, vi } from "vitest";
import { buildSendDocument } from "../src/drive/delivery.js";
import { createDriveDocumentSender } from "../src/drive/sender.js";

afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

type Call = { url: string; init: any };
function stub(reply: (c: Call) => { status?: number; text: string }) {
  const calls: Call[] = [];
  vi.stubGlobal("fetch", async (url: string, init: any = {}) => {
    const c = { url, init };
    calls.push(c);
    const r = reply(c);
    const status = r.status ?? 200;
    return { ok: status < 400, status, text: async () => r.text, json: async () => JSON.parse(r.text) };
  });
  return calls;
}

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
    const failing = { uploadDocument: async () => { throw new Error("вхід у Google (токен): invalid_grant"); } };
    await createDriveDocumentSender("T", failing, fallback)(42, Buffer.from("x"), "a.docx", "№ 1");
    expect(fallback).toHaveBeenCalledWith(42, expect.any(Buffer), "a.docx", "№ 1\nGoogle Диск не спрацював: вхід у Google (токен): invalid_grant");
  });
});

describe("вибір способу доставки", () => {
  const buf = Buffer.from("x");
  const kv = { get: async () => null, set: async () => undefined };
  const NOTE = "Google Диск не налаштований: немає змінних GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REFRESH_TOKEN";

  it("без змінних OAuth використовує запасну доставку й пояснює чому", async () => {
    const fallback = vi.fn(async () => undefined);
    await buildSendDocument("T", fallback, kv, {})(1, buf, "a.docx", "№ 1");
    expect(fallback).toHaveBeenCalledWith(1, buf, "a.docx", `№ 1\n${NOTE}`);
    await buildSendDocument("T", fallback, kv, { GOOGLE_CLIENT_ID: "c", GOOGLE_CLIENT_SECRET: "s" })(1, buf, "a.docx", "№ 1");
    expect(fallback).toHaveBeenLastCalledWith(1, buf, "a.docx", `№ 1\n${NOTE}`);
  });

  it("зі змінними OAuth надсилає через Диск, а не запасним шляхом", async () => {
    const calls = stub((c) => {
      if (c.url.includes("oauth2.googleapis.com")) return { text: JSON.stringify({ access_token: "AT", expires_in: 3600 }) };
      if (c.url.includes("fields=id,webViewLink")) return { text: JSON.stringify({ id: "F1" }) };
      if (c.url.includes("fields=id")) return { text: JSON.stringify({ id: "FOLDER" }) };
      return { text: "{}" };
    });
    const fallback = vi.fn(async () => undefined);
    const env = { GOOGLE_CLIENT_ID: " c ", GOOGLE_CLIENT_SECRET: "s", GOOGLE_REFRESH_TOKEN: "r\n" };
    await buildSendDocument("T", fallback, kv, env)(1, buf, "a.docx", "№ 1");
    expect(fallback).not.toHaveBeenCalled();
    expect(calls.some((c) => c.url.includes("upload/drive/v3/files"))).toBe(true);
    expect(String(calls[0]!.init.body)).toContain("client_id=c&");
  });
});
