import type { SendDocument } from "../bot/telegram.js";
import { GoogleDrive, parseServiceAccount } from "./google.js";
import { createDriveDocumentSender } from "./sender.js";

// Запасна доставка з приміткою в підписі, щоб причину було видно в чаті, а не лише в логах
function withNote(fallback: SendDocument, note: string): SendDocument {
  return (chatId, file, filename, caption) => fallback(chatId, file, filename, `${caption}\n${note}`);
}

export function buildSendDocument(token: string, fallback: SendDocument, env: NodeJS.ProcessEnv = process.env): SendDocument {
  const { GOOGLE_SERVICE_ACCOUNT_JSON: accountJson, GOOGLE_DRIVE_FOLDER_ID: folderId } = env;
  const missing = [!accountJson && "GOOGLE_SERVICE_ACCOUNT_JSON", !folderId && "GOOGLE_DRIVE_FOLDER_ID"].filter(Boolean);
  if (!accountJson || !folderId) return withNote(fallback, `Google Диск не налаштований: немає змінної ${missing.join(", ")}`);
  try {
    return createDriveDocumentSender(token, new GoogleDrive({ account: parseServiceAccount(accountJson), folderId }), fallback);
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    console.error("Некоректні налаштування Google Диска:", reason);
    return withNote(fallback, `Google Диск: некоректний ключ (${reason.slice(0, 120)})`);
  }
}
