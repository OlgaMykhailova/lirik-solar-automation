import { afterEach, describe, expect, it, vi } from "vitest";
import { buildSendDocument } from "../src/drive/delivery.js";

afterEach(() => vi.restoreAllMocks());

const buf = Buffer.from("x");

describe("вибір способу доставки", () => {
  it("без налаштувань Диска використовує запасну доставку й називає відсутню змінну", async () => {
    const fallback = vi.fn(async () => undefined);
    await buildSendDocument("T", fallback, {})(1, buf, "a.docx", "№ 1");
    expect(fallback).toHaveBeenCalledWith(1, buf, "a.docx", "№ 1\nGoogle Диск не налаштований: немає змінної GOOGLE_SERVICE_ACCOUNT_JSON, GOOGLE_DRIVE_FOLDER_ID");
    await buildSendDocument("T", fallback, { GOOGLE_SERVICE_ACCOUNT_JSON: "{}" })(1, buf, "a.docx", "№ 1");
    expect(fallback).toHaveBeenLastCalledWith(1, buf, "a.docx", expect.stringContaining("немає змінної GOOGLE_DRIVE_FOLDER_ID"));
  });

  it("зламаний ключ не кидає помилку, а пояснює причину в підписі", async () => {
    const fallback = vi.fn(async () => undefined);
    const err = vi.spyOn(console, "error").mockImplementation(() => undefined);
    await buildSendDocument("T", fallback, { GOOGLE_DRIVE_FOLDER_ID: "F", GOOGLE_SERVICE_ACCOUNT_JSON: "це не json" })(1, buf, "a.docx", "№ 1");
    expect(err).toHaveBeenCalledWith("Некоректні налаштування Google Диска:", expect.any(String));
    expect(fallback).toHaveBeenCalledWith(1, buf, "a.docx", expect.stringMatching(/^№ 1\nGoogle Диск: некоректний ключ \(/));
  });

  it("правильний ключ дає відправника через Диск, а не запасну доставку", () => {
    const fallback = vi.fn(async () => undefined);
    const json = JSON.stringify({ client_email: "a@b.c", private_key: "k" });
    buildSendDocument("T", fallback, { GOOGLE_DRIVE_FOLDER_ID: "F", GOOGLE_SERVICE_ACCOUNT_JSON: json });
    expect(fallback).not.toHaveBeenCalled();
  });
});
