export interface UploadedFile {
  id: string;
  viewUrl: string;
  downloadUrl: string;
}

export interface DocumentUploader {
  uploadDocument(file: Buffer, filename: string): Promise<UploadedFile>;
}

const TIMEOUT_MS = 20_000;

// Файл зберігає Google Apps Script, розгорнутий від імені власника Диска (apps-script/Code.gs):
// сервісні акаунти Google не мають власного сховища на звичайному Диску.
export class AppsScriptDrive implements DocumentUploader {
  constructor(
    private url: string,
    private secret: string,
  ) {}

  async uploadDocument(file: Buffer, filename: string): Promise<UploadedFile> {
    const started = Date.now();
    let res: Response;
    try {
      res = await fetch(this.url, {
        method: "POST",
        headers: { "content-type": "text/plain;charset=utf-8" },
        body: JSON.stringify({ secret: this.secret, name: filename, data: file.toString("base64") }),
        redirect: "follow",
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    } catch (err) {
      const sec = Math.round((Date.now() - started) / 1000);
      if (err instanceof Error && (err.name === "TimeoutError" || err.name === "AbortError")) {
        throw new Error(`скрипт Google не відповів за ${sec} с`);
      }
      throw new Error(`скрипт Google недоступний: ${err instanceof Error ? err.message : String(err)}`);
    }
    const text = await res.text();
    let data: { ok?: boolean; id?: string; url?: string; error?: string };
    try {
      data = JSON.parse(text);
    } catch {
      throw new Error(`скрипт Google повернув не JSON (HTTP ${res.status}); перевірте розгортання: доступ «Anyone» і адреса /exec. Початок відповіді: ${text.replace(/\s+/g, " ").slice(0, 120)}`);
    }
    if (!data.ok || !data.id) throw new Error(`скрипт Google: ${data.error ?? "невідома помилка"}`);
    return {
      id: data.id,
      viewUrl: data.url ?? `https://drive.google.com/file/d/${data.id}/view`,
      downloadUrl: `https://drive.google.com/uc?export=download&id=${data.id}`,
    };
  }
}
