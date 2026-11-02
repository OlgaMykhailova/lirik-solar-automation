import { afterEach, describe, expect, it, vi } from "vitest";
import { MemoryFileStore } from "../src/bot/files.js";
import { createUrlDocumentSender, fileUrl } from "../src/bot/telegram.js";

afterEach(() => vi.unstubAllGlobals());

function stubFetch(responses: Array<{ ok: boolean; status?: number; text?: string }>) {
  const calls: { url: string; body: any }[] = [];
  vi.stubGlobal("fetch", async (url: string, init: any) => {
    calls.push({ url, body: JSON.parse(init.body) });
    const r = responses.shift() ?? { ok: true };
    return { ok: r.ok, status: r.status ?? 200, text: async () => r.text ?? "" };
  });
  return calls;
}

describe("відправка документа за посиланням", () => {
  it("зберігає файл і просить Telegram забрати його за URL", async () => {
    const calls = stubFetch([{ ok: true }]);
    const store = new MemoryFileStore();
    const file = Buffer.from("docx-bytes");
    await createUrlDocumentSender("T", store, () => "https://app.example")(42, file, "Рахунок 06-02-10.docx", "№ 06-02-10");
    expect(calls).toHaveLength(1);
    expect(calls[0]!.url).toBe("https://api.telegram.org/botT/sendDocument");
    const url = new URL(calls[0]!.body.document);
    expect(url.origin).toBe("https://app.example");
    const [, , id, name] = url.pathname.split("/");
    expect(decodeURIComponent(name!)).toBe("Рахунок 06-02-10.docx");
    expect(await store.get(id!)).toEqual(file);
    expect(calls[0]!.body).toMatchObject({ chat_id: 42, caption: "№ 06-02-10" });
  });

  it("якщо Telegram не прийняв посилання, надсилає це посилання текстом", async () => {
    const calls = stubFetch([{ ok: false, status: 400, text: "wrong type" }, { ok: true }]);
    await createUrlDocumentSender("T", new MemoryFileStore(), () => "https://app.example")(42, Buffer.from("x"), "a.docx", "№ 1");
    expect(calls.map((c) => c.url.split("/").pop())).toEqual(["sendDocument", "sendMessage"]);
    expect(calls[1]!.body.text).toContain("https://app.example/f/");
  });

  it("fileUrl кодує назву файлу", () => {
    expect(fileUrl("https://a", "id", "a b.docx")).toBe("https://a/f/id/a%20b.docx");
  });
});
