import type { SendDocument } from "../bot/telegram.js";
import type { GoogleDrive } from "./google.js";

const TIMEOUT_MS = 15_000;

// Документ кладемо на Google Диск, у чат надсилаємо кнопки з посиланнями.
// Прямі завантаження файлів у Telegram для цього бота зависають, тому файл через Telegram не йде.
export function createDriveDocumentSender(token: string, drive: GoogleDrive, fallback: SendDocument): SendDocument {
  return async (chatId, file, filename, caption) => {
    let uploaded;
    try {
      uploaded = await drive.uploadDocument(file, filename);
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      console.error("Google Диск недоступний, використовую запасну доставку:", reason);
      return fallback(chatId, file, filename, `${caption}\nGoogle Диск не спрацював: ${reason.slice(0, 250)}`);
    }
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: `${caption}\n${filename}`,
        reply_markup: {
          inline_keyboard: [[
            { text: "Відкрити", url: uploaded.viewUrl },
            { text: "Завантажити", url: uploaded.downloadUrl },
          ]],
        },
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) throw new Error(`sendMessage ${res.status}: ${(await res.text()).slice(0, 200)}`);
  };
}
