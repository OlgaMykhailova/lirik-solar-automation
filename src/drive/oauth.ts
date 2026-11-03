import { randomBytes } from "node:crypto";
import { DOCX_MIME } from "../bot/telegram.js";
import type { DocumentUploader, Kv, UploadedFile } from "./types.js";

interface OAuthConfig {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
  folderName?: string;
}

const API = "https://www.googleapis.com";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const TIMEOUT_MS = 15_000;
const FOLDER_KEY = "drive:folder";
const FOLDER_MIME = "application/vnd.google-apps.folder";

async function step<T>(stage: string, run: () => Promise<T>): Promise<T> {
  const started = Date.now();
  try {
    return await run();
  } catch (err) {
    const sec = Math.round((Date.now() - started) / 1000);
    if (err instanceof Error && (err.name === "TimeoutError" || err.name === "AbortError")) {
      throw new Error(`${stage}: немає відповіді від Google за ${sec} с`);
    }
    throw new Error(`${stage}: ${err instanceof Error ? err.message : String(err)}`);
  }
}

// Диск від імені власника через OAuth (scope drive.file): файли належать власнику й рахуються в його квоті,
// бот бачить лише створену ним папку й файли. Доступ до файлів визначається поширенням папки.
export class OAuthDrive implements DocumentUploader {
  private token?: { value: string; expiresAt: number };

  constructor(
    private cfg: OAuthConfig,
    private kv: Kv,
  ) {}

  private async accessToken(): Promise<string> {
    if (this.token && this.token.expiresAt > Date.now() + 60_000) return this.token.value;
    const { res, data } = await step("вхід у Google (токен)", async () => {
      const res = await fetch(TOKEN_URL, {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: this.cfg.clientId,
          client_secret: this.cfg.clientSecret,
          refresh_token: this.cfg.refreshToken,
          grant_type: "refresh_token",
        }),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      const data = (await res.json()) as { access_token?: string; expires_in?: number; error?: string; error_description?: string };
      return { res, data };
    });
    if (!res.ok || !data.access_token) throw new Error(`вхід у Google (токен): ${data.error ?? res.status} ${data.error_description ?? ""}`.trim());
    this.token = { value: data.access_token, expiresAt: Date.now() + (data.expires_in ?? 3600) * 1000 };
    return this.token.value;
  }

  private async createFolder(): Promise<string> {
    const authorization = `Bearer ${await this.accessToken()}`;
    const id = await step("створення папки на Диску", async () => {
      const res = await fetch(`${API}/drive/v3/files?fields=id`, {
        method: "POST",
        headers: { authorization, "content-type": "application/json" },
        body: JSON.stringify({ name: this.cfg.folderName ?? "Рахунки та накладні", mimeType: FOLDER_MIME }),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      if (!res.ok) throw new Error(`відповідь ${res.status}: ${(await res.text()).slice(0, 300)}`);
      return ((await res.json()) as { id: string }).id;
    });
    await this.kv.set(FOLDER_KEY, id);
    return id;
  }

  private async upload(file: Buffer, filename: string, folderId: string): Promise<{ status: number; id?: string; link?: string; text?: string }> {
    const boundary = `b${randomBytes(12).toString("hex")}`;
    const meta = JSON.stringify({ name: filename, parents: [folderId] });
    const head = Buffer.from(
      `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${meta}\r\n--${boundary}\r\nContent-Type: ${DOCX_MIME}\r\n\r\n`,
    );
    const body = Buffer.concat([head, file, Buffer.from(`\r\n--${boundary}--`)]);
    const authorization = `Bearer ${await this.accessToken()}`;
    return step("завантаження файлу на Диск", async () => {
      const res = await fetch(`${API}/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink`, {
        method: "POST",
        headers: { authorization, "content-type": `multipart/related; boundary=${boundary}` },
        body,
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      if (!res.ok) return { status: res.status, text: (await res.text()).slice(0, 300) };
      const data = (await res.json()) as { id: string; webViewLink?: string };
      return { status: res.status, id: data.id, link: data.webViewLink };
    });
  }

  async uploadDocument(file: Buffer, filename: string): Promise<UploadedFile> {
    let folderId = (await this.kv.get(FOLDER_KEY)) ?? (await this.createFolder());
    let result = await this.upload(file, filename, folderId);
    if (result.status === 404) {
      // папку видалили або перенесли в кошик
      folderId = await this.createFolder();
      result = await this.upload(file, filename, folderId);
    }
    if (!result.id) throw new Error(`завантаження файлу на Диск: відповідь ${result.status}: ${result.text ?? ""}`);
    return {
      id: result.id,
      viewUrl: result.link ?? `https://drive.google.com/file/d/${result.id}/view`,
      downloadUrl: `https://drive.google.com/uc?export=download&id=${result.id}`,
    };
  }
}
