import { afterEach, describe, expect, it, vi } from "vitest";
import { buildSendDocument } from "../src/drive/delivery.js";

afterEach(() => vi.restoreAllMocks());

describe("вибір способу доставки", () => {
  const fallback = vi.fn(async () => undefined);

  it("без налаштувань Диска повертає запасну доставку", () => {
    expect(buildSendDocument("T", fallback, {})).toBe(fallback);
    expect(buildSendDocument("T", fallback, { GOOGLE_DRIVE_FOLDER_ID: "F" })).toBe(fallback);
  });

  it("зламаний ключ не кидає помилку, а лишає запасну доставку", () => {
    const err = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const send = buildSendDocument("T", fallback, { GOOGLE_DRIVE_FOLDER_ID: "F", GOOGLE_SERVICE_ACCOUNT_JSON: "це не json" });
    expect(send).toBe(fallback);
    expect(err).toHaveBeenCalledWith("Некоректні налаштування Google Диска:", expect.any(String));
  });

  it("правильний ключ дає відправника через Диск", () => {
    const json = JSON.stringify({ client_email: "a@b.c", private_key: "k" });
    const send = buildSendDocument("T", fallback, { GOOGLE_DRIVE_FOLDER_ID: "F", GOOGLE_SERVICE_ACCOUNT_JSON: json });
    expect(send).not.toBe(fallback);
  });
});
