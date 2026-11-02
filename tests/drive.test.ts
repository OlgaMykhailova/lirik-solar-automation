import { createPublicKey, createVerify, generateKeyPairSync } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { GoogleDrive, parseServiceAccount, signJwt } from "../src/drive/google.js";
import { createDriveDocumentSender } from "../src/drive/sender.js";

afterEach(() => vi.unstubAllGlobals());

const { privateKey, publicKey } = generateKeyPairSync("rsa", {
  modulusLength: 2048,
  privateKeyEncoding: { type: "pkcs8", format: "pem" },
  publicKeyEncoding: { type: "spki", format: "pem" },
});
const account = { client_email: "bot@proj.iam.gserviceaccount.com", private_key: privateKey };
const cfg = { account, folderId: "FOLDER1" };

type Call = { url: string; method: string; headers: Record<string, string>; body: any };
function stub(handler: (c: Call) => { status?: number; json?: unknown; text?: string }) {
  const calls: Call[] = [];
  vi.stubGlobal("fetch", async (url: string, init: any = {}) => {
    const call = { url, method: init.method ?? "GET", headers: init.headers ?? {}, body: init.body };
    calls.push(call);
    const r = handler(call);
    const status = r.status ?? 200;
    return { ok: status < 400, status, json: async () => r.json, text: async () => r.text ?? JSON.stringify(r.json ?? "") };
  });
  return calls;
}

const happy = (c: Call) => {
  if (c.url.includes("oauth2.googleapis.com")) return { json: { access_token: "AT", expires_in: 3600 } };
  if (c.url.includes("uploadType=multipart")) return { json: { id: "FILE1", webViewLink: "https://drive.google.com/file/d/FILE1/view" } };
  return { status: 500, text: "unexpected " + c.url };
};

describe("сервісний акаунт", () => {
  it("підписує JWT, який перевіряється публічним ключем", () => {
    const jwt = signJwt(account, 1_000_000);
    const [h, c, sig] = jwt.split(".");
    expect(JSON.parse(Buffer.from(h!, "base64url").toString())).toEqual({ alg: "RS256", typ: "JWT" });
    expect(JSON.parse(Buffer.from(c!, "base64url").toString())).toMatchObject({
      iss: account.client_email,
      aud: "https://oauth2.googleapis.com/token",
      scope: "https://www.googleapis.com/auth/drive",
      iat: 1_000_000,
      exp: 1_003_600,
    });
    expect(createVerify("RSA-SHA256").update(`${h}.${c}`).verify(createPublicKey(publicKey), Buffer.from(sig!, "base64url"))).toBe(true);
  });

  it("парсить JSON-ключ і відхиляє неповний", () => {
    expect(parseServiceAccount(JSON.stringify({ ...account, extra: 1 }))).toEqual(account);
    expect(() => parseServiceAccount("{}")).toThrow(/client_email/);
  });
});

describe("GoogleDrive", () => {
  it("завантажує файл у вказану папку й кешує токен", async () => {
    const calls = stub(happy);
    const drive = new GoogleDrive(cfg);
    const file = Buffer.from("DOCX-БАЙТИ");
    const up = await drive.uploadDocument(file, "Рахунок 02-11-10.docx");
    expect(up).toEqual({ id: "FILE1", viewUrl: "https://drive.google.com/file/d/FILE1/view", downloadUrl: "https://drive.google.com/uc?export=download&id=FILE1" });

    const upload = calls.find((c) => c.url.includes("uploadType=multipart"))!;
    expect(upload.headers.authorization).toBe("Bearer AT");
    expect(upload.headers["content-type"]).toMatch(/^multipart\/related; boundary=/);
    const body = (upload.body as Buffer).toString("utf8");
    expect(body).toContain('"name":"Рахунок 02-11-10.docx"');
    expect(body).toContain('"parents":["FOLDER1"]');
    expect(body).toContain("DOCX-БАЙТИ");
    expect(calls.some((c) => c.url.includes("/permissions"))).toBe(false);

    await drive.uploadDocument(file, "b.docx");
    expect(calls.filter((c) => c.url.includes("oauth2.googleapis.com"))).toHaveLength(1);
  });

  it("повідомляє про відмову Диска (наприклад, немає доступу до папки)", async () => {
    stub((c) => (c.url.includes("oauth2") ? happy(c) : { status: 404, text: "File not found: FOLDER1" }));
    await expect(new GoogleDrive(cfg).uploadDocument(Buffer.from("x"), "a.docx")).rejects.toThrow(/404/);
  });

  it("повідомляє про помилку входу", async () => {
    stub(() => ({ status: 400, json: { error: "invalid_grant", error_description: "bad jwt" } }));
    await expect(new GoogleDrive(cfg).uploadDocument(Buffer.from("x"), "a.docx")).rejects.toThrow(/invalid_grant/);
  });
});

describe("відправник через Диск", () => {
  it("надсилає в чат кнопки Відкрити/Завантажити", async () => {
    const calls = stub((c) => (c.url.includes("api.telegram.org") ? { json: { ok: true } } : happy(c)));
    const fallback = vi.fn();
    await createDriveDocumentSender("T", new GoogleDrive(cfg), fallback)(42, Buffer.from("x"), "a.docx", "№ 02-11-10");
    const payload = JSON.parse(calls.find((c) => c.url.includes("api.telegram.org/botT/sendMessage"))!.body);
    expect(payload.chat_id).toBe(42);
    expect(payload.text).toBe("№ 02-11-10\na.docx");
    expect(payload.reply_markup.inline_keyboard[0].map((b: any) => b.text)).toEqual(["Відкрити", "Завантажити"]);
    expect(fallback).not.toHaveBeenCalled();
  });

  it("при збої Диска переходить на запасну доставку", async () => {
    stub(() => ({ status: 400, json: { error: "invalid_grant" } }));
    const fallback = vi.fn(async () => undefined);
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    await createDriveDocumentSender("T", new GoogleDrive(cfg), fallback)(42, Buffer.from("x"), "a.docx", "№ 1");
    expect(fallback).toHaveBeenCalledWith(42, expect.any(Buffer), "a.docx", "№ 1");
  });
});
