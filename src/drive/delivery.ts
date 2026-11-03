import type { SendDocument } from "../bot/telegram.js";
import { OAuthDrive } from "./oauth.js";
import { createDriveDocumentSender } from "./sender.js";
import type { Kv } from "./types.js";

// Запасна доставка з приміткою в підписі, щоб причину було видно в чаті, а не лише в логах
function withNote(fallback: SendDocument, note: string): SendDocument {
  return (chatId, file, filename, caption) => fallback(chatId, file, filename, `${caption}\n${note}`);
}

export function buildSendDocument(token: string, fallback: SendDocument, kv: Kv, env: NodeJS.ProcessEnv = process.env): SendDocument {
  const { GOOGLE_CLIENT_ID: clientId, GOOGLE_CLIENT_SECRET: clientSecret, GOOGLE_REFRESH_TOKEN: refreshToken } = env;
  if (!clientId || !clientSecret || !refreshToken) {
    return withNote(fallback, "Google Диск не налаштований: немає змінних GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REFRESH_TOKEN");
  }
  const drive = new OAuthDrive({ clientId: clientId.trim(), clientSecret: clientSecret.trim(), refreshToken: refreshToken.trim() }, kv);
  return createDriveDocumentSender(token, drive, fallback);
}
