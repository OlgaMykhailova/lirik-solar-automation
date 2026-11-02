import { createSign, randomBytes } from "node:crypto";
import { DOCX_MIME } from "../bot/telegram.js";

export interface ServiceAccount {
  client_email: string;
  private_key: string;
}

export interface DriveConfig {
  account: ServiceAccount;
  folderId: string;
}

export interface UploadedFile {
  id: string;
  viewUrl: string;
  downloadUrl: string;
}

const API = "https://www.googleapis.com";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const SCOPE = "https://www.googleapis.com/auth/drive";
const TIMEOUT_MS = 15_000;

export function parseServiceAccount(json: string): ServiceAccount {
  const data = JSON.parse(json) as Partial<ServiceAccount>;
  if (!data.client_email || !data.private_key) throw new Error("У GOOGLE_SERVICE_ACCOUNT_JSON немає client_email або private_key");
  return { client_email: data.client_email, private_key: data.private_key };
}

const b64url = (v: Buffer | string) => Buffer.from(v).toString("base64url");

export function signJwt(account: ServiceAccount, nowSec: number): string {
  const header = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claim = b64url(
    JSON.stringify({ iss: account.client_email, scope: SCOPE, aud: TOKEN_URL, iat: nowSec, exp: nowSec + 3600 }),
  );
  const signature = createSign("RSA-SHA256").update(`${header}.${claim}`).sign(account.private_key);
  return `${header}.${claim}.${b64url(signature)}`;
}

export class GoogleDrive {
  private token?: { value: string; expiresAt: number };

  constructor(private cfg: DriveConfig) {}

  private async accessToken(): Promise<string> {
    if (this.token && this.token.expiresAt > Date.now() + 60_000) return this.token.value;
    const res = await fetch(TOKEN_URL, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
        assertion: signJwt(this.cfg.account, Math.floor(Date.now() / 1000)),
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    const data = (await res.json()) as { access_token?: string; expires_in?: number; error?: string; error_description?: string };
    if (!res.ok || !data.access_token) throw new Error(`Google OAuth: ${data.error ?? res.status} ${data.error_description ?? ""}`.trim());
    this.token = { value: data.access_token, expiresAt: Date.now() + (data.expires_in ?? 3600) * 1000 };
    return this.token.value;
  }

  async uploadDocument(file: Buffer, filename: string): Promise<UploadedFile> {
    const boundary = `b${randomBytes(12).toString("hex")}`;
    const meta = JSON.stringify({ name: filename, parents: [this.cfg.folderId] });
    const head = Buffer.from(
      `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${meta}\r\n--${boundary}\r\nContent-Type: ${DOCX_MIME}\r\n\r\n`,
    );
    const body = Buffer.concat([head, file, Buffer.from(`\r\n--${boundary}--`)]);
    const res = await fetch(`${API}/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true&fields=id,webViewLink`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${await this.accessToken()}`,
        "content-type": `multipart/related; boundary=${boundary}`,
      },
      body,
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) throw new Error(`Drive завантаження ${res.status}: ${(await res.text()).slice(0, 300)}`);
    const { id, webViewLink } = (await res.json()) as { id: string; webViewLink?: string };
    return {
      id,
      viewUrl: webViewLink ?? `https://drive.google.com/file/d/${id}/view`,
      downloadUrl: `https://drive.google.com/uc?export=download&id=${id}`,
    };
  }
}
