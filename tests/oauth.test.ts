import { afterEach, describe, expect, it, vi } from "vitest";
import { OAuthDrive } from "../src/drive/oauth.js";
import type { Kv } from "../src/drive/types.js";

afterEach(() => vi.unstubAllGlobals());

class MemKv implements Kv {
  m = new Map<string, string>();
  async get(k: string) { return this.m.get(k) ?? null; }
  async set(k: string, v: string) { this.m.set(k, v); }
}
const cfg = { clientId: "cid", clientSecret: "sec", refreshToken: "rt" };

type Call = { url: string; init: any };
function stub(handler: (c: Call) => { status?: number; json?: unknown; text?: string } | Error) {
  const calls: Call[] = [];
  vi.stubGlobal("fetch", async (url: string, init: any = {}) => {
    const c = { url, init };
    calls.push(c);
    const r = handler(c);
    if (r instanceof Error) throw r;
    const status = r.status ?? 200;
    return { ok: status < 400, status, json: async () => r.json, text: async () => r.text ?? JSON.stringify(r.json ?? "") };
  });
  return calls;
}

const happy = (c: Call) => {
  if (c.url.includes("oauth2.googleapis.com")) return { json: { access_token: "AT", expires_in: 3600 } };
  if (c.url.includes("uploadType=multipart")) return { json: { id: "FILE1", webViewLink: "https://drive.google.com/file/d/FILE1/view" } };
  if (c.url.includes("/drive/v3/files?fields=id")) return { json: { id: "FOLDER1" } };
  return { status: 500, text: "unexpected " + c.url };
};

describe("OAuthDrive", () => {
  it("створює папку один раз, завантажує файл у неї й кешує токен", async () => {
    const calls = stub(happy);
    const kv = new MemKv();
    const drive = new OAuthDrive(cfg, kv);
    const up = await drive.uploadDocument(Buffer.from("DOCX-БАЙТИ"), "Рахунок 02-11-10.docx");
    expect(up).toEqual({ id: "FILE1", viewUrl: "https://drive.google.com/file/d/FILE1/view", downloadUrl: "https://drive.google.com/uc?export=download&id=FILE1" });
    expect(kv.m.get("drive:folder")).toBe("FOLDER1");

    const token = calls.find((c) => c.url.includes("oauth2"))!;
    expect(String(token.init.body)).toContain("grant_type=refresh_token");
    expect(String(token.init.body)).toContain("refresh_token=rt");

    const upload = calls.find((c) => c.url.includes("uploadType=multipart"))!;
    expect(upload.init.headers.authorization).toBe("Bearer AT");
    const body = (upload.init.body as Buffer).toString("utf8");
    expect(body).toContain('"parents":["FOLDER1"]');
    expect(body).toContain('"name":"Рахунок 02-11-10.docx"');
    expect(body).toContain("DOCX-БАЙТИ");
    expect(calls.some((c) => c.url.includes("/permissions"))).toBe(false);

    await drive.uploadDocument(Buffer.from("x"), "b.docx");
    expect(calls.filter((c) => c.url.includes("/drive/v3/files?fields=id"))).toHaveLength(1);
    expect(calls.filter((c) => c.url.includes("oauth2"))).toHaveLength(1);
  });

  it("якщо папку видалили (404), створює нову й повторює", async () => {
    let first = true;
    stub((c) => {
      if (c.url.includes("uploadType=multipart") && first) { first = false; return { status: 404, text: "not found" }; }
      return happy(c);
    });
    const kv = new MemKv();
    kv.m.set("drive:folder", "OLD");
    expect((await new OAuthDrive(cfg, kv).uploadDocument(Buffer.from("x"), "a.docx")).id).toBe("FILE1");
    expect(kv.m.get("drive:folder")).toBe("FOLDER1");
  });

  it("називає причину відмови токена й крок із тайм-аутом", async () => {
    stub(() => ({ status: 400, json: { error: "invalid_grant", error_description: "Token has been expired or revoked." } }));
    await expect(new OAuthDrive(cfg, new MemKv()).uploadDocument(Buffer.from("x"), "a.docx")).rejects.toThrow(/вхід у Google \(токен\): invalid_grant Token has been expired/);
    stub((c) => (c.url.includes("oauth2") ? happy(c) : Object.assign(new Error("t"), { name: "TimeoutError" })));
    const kv = new MemKv();
    kv.m.set("drive:folder", "F");
    await expect(new OAuthDrive(cfg, kv).uploadDocument(Buffer.from("x"), "a.docx")).rejects.toThrow(/завантаження файлу на Диск: немає відповіді від Google за \d+ с/);
  });

  it("повідомляє відповідь Google, якщо завантаження відхилено", async () => {
    stub((c) => (c.url.includes("uploadType=multipart") ? { status: 403, text: "insufficientPermissions" } : happy(c)));
    const kv = new MemKv();
    kv.m.set("drive:folder", "F");
    await expect(new OAuthDrive(cfg, kv).uploadDocument(Buffer.from("x"), "a.docx")).rejects.toThrow(/відповідь 403: insufficientPermissions/);
  });
});
