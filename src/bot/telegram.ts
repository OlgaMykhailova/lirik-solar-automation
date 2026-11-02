import { randomBytes } from "node:crypto";

export type SendDocument = (chatId: number, file: Buffer, filename: string, caption: string) => Promise<void>;

export interface FileStore {
  put(id: string, file: Buffer): Promise<void>;
  get(id: string): Promise<Buffer | null>;
}

export const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const SEND_TIMEOUT_MS = 15_000;

export function fileUrl(baseUrl: string, id: string, filename: string): string {
  return `${baseUrl}/f/${id}/${encodeURIComponent(filename)}`;
}

async function callTelegram(token: string, method: string, payload: object): Promise<void> {
  const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(SEND_TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`${method} ${res.status}: ${(await res.text()).slice(0, 200)}`);
}

// Завантаження файлів (multipart) на сервери Telegram для цього бота зависає з 504,
// тому файл зберігаємо на кілька хвилин у себе, а Telegram забирає його за посиланням.
export function createUrlDocumentSender(token: string, store: FileStore, getBaseUrl: () => string): SendDocument {
  return async (chatId, file, filename, caption) => {
    const id = randomBytes(16).toString("hex");
    await store.put(id, file);
    const url = fileUrl(getBaseUrl(), id, filename);
    try {
      await callTelegram(token, "sendDocument", { chat_id: chatId, document: url, caption });
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      console.error("sendDocument за посиланням не вдався:", reason);
      await callTelegram(token, "sendMessage", {
        chat_id: chatId,
        text: `${caption}\nНе вдалося надіслати файл напряму. Завантажте його за посиланням (діє 15 хвилин):\n${url}`,
      });
    }
  };
}
