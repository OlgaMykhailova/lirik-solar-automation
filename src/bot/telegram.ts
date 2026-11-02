export type SendDocument = (chatId: number, file: Buffer, filename: string, caption: string) => Promise<void>;

const ATTEMPTS = 2;
const ATTEMPT_TIMEOUT_MS = 10_000;

// grammY шле файл потоковим multipart без Content-Length, і Telegram інколи відповідає 504.
// Тут тіло збирається заздалегідь, тож запит іде зі сталою довжиною.
export function createDocumentSender(token: string): SendDocument {
  return async (chatId, file, filename, caption) => {
    const form = new FormData();
    form.set("chat_id", String(chatId));
    form.set("caption", caption);
    form.set("document", new Blob([new Uint8Array(file)]), filename);
    const packed = new Response(form);
    const contentType = packed.headers.get("content-type") ?? "";
    const body = Buffer.from(await packed.arrayBuffer());

    let lastError: unknown;
    for (let attempt = 1; attempt <= ATTEMPTS; attempt++) {
      try {
        const res = await fetch(`https://api.telegram.org/bot${token}/sendDocument`, {
          method: "POST",
          headers: { "content-type": contentType, "content-length": String(body.length) },
          body,
          signal: AbortSignal.timeout(ATTEMPT_TIMEOUT_MS),
        });
        if (res.ok) return;
        const text = await res.text();
        lastError = new Error(`sendDocument ${res.status}: ${text.slice(0, 200)}`);
        if (res.status < 500) break;
      } catch (e) {
        lastError = e;
      }
    }
    throw lastError instanceof Error ? lastError : new Error(String(lastError));
  };
}
