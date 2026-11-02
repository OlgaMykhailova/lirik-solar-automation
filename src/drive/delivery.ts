import type { SendDocument } from "../bot/telegram.js";
import { AppsScriptDrive } from "./appsscript.js";
import { createDriveDocumentSender } from "./sender.js";

// Запасна доставка з приміткою в підписі, щоб причину було видно в чаті, а не лише в логах
function withNote(fallback: SendDocument, note: string): SendDocument {
  return (chatId, file, filename, caption) => fallback(chatId, file, filename, `${caption}\n${note}`);
}

export function buildSendDocument(token: string, fallback: SendDocument, env: NodeJS.ProcessEnv = process.env): SendDocument {
  const { GOOGLE_SCRIPT_URL: url, GOOGLE_SCRIPT_SECRET: secret } = env;
  const missing = [!url && "GOOGLE_SCRIPT_URL", !secret && "GOOGLE_SCRIPT_SECRET"].filter(Boolean);
  if (!url || !secret) return withNote(fallback, `Google Диск не налаштований: немає змінної ${missing.join(", ")}`);
  return createDriveDocumentSender(token, new AppsScriptDrive(url.trim(), secret.trim()), fallback);
}
