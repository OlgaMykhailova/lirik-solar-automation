import type { SendDocument } from "../bot/telegram.js";
import { GoogleDrive, parseServiceAccount } from "./google.js";
import { createDriveDocumentSender } from "./sender.js";

export function buildSendDocument(token: string, fallback: SendDocument, env: NodeJS.ProcessEnv = process.env): SendDocument {
  const { GOOGLE_SERVICE_ACCOUNT_JSON: accountJson, GOOGLE_DRIVE_FOLDER_ID: folderId } = env;
  if (!accountJson || !folderId) return fallback;
  try {
    return createDriveDocumentSender(token, new GoogleDrive({ account: parseServiceAccount(accountJson), folderId }), fallback);
  } catch (err) {
    // помилка в налаштуваннях Диска не має ламати бота: працюємо із запасною доставкою
    console.error("Некоректні налаштування Google Диска:", err instanceof Error ? err.message : err);
    return fallback;
  }
}
