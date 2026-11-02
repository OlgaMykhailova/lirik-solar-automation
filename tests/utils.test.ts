import { describe, expect, it } from "vitest";
import { amountInWords, longDate } from "../src/utils/words.js";
import { formatKop, priceInKop, priceItems, totalKop } from "../src/utils/money.js";
import { MemoryCounterStore, formatDocNumber, nextDocNumber } from "../src/data/counters.js";

describe("amountInWords", () => {
  it.each([
    [92865_00, "Дев'яносто дві тисячі вісімсот шістдесят п'ять гривень 00 копійок"],
    [240315_00, "Двісті сорок тисяч триста п'ятнадцять гривень 00 копійок"],
    [150420_00, "Сто п'ятдесят тисяч чотириста двадцять гривень 00 копійок"],
    [94470_00, "Дев'яносто чотири тисячі чотириста сімдесят гривень 00 копійок"],
    [1_00, "Одна гривня 00 копійок"],
    [2001_05, "Дві тисячі одна гривня 05 копійок"],
    [1_000_000_00, "Один мільйон гривень 00 копійок"],
  ])("%i", (kop, words) => expect(amountInWords(kop)).toBe(words));
});

describe("money", () => {
  it("конвертує USD у грн у копійках", () => {
    expect(priceInKop("1000", "41.5")).toBe(41500_00);
    expect(priceInKop("12,34", "41,2345")).toBe(50883);
    expect(priceInKop("abc", "41")).toBeNull();
  });
  it("рахує суми й підсумок", () => {
    const items = priceItems([{ name: "a", qty: 4, priceUsd: "1000", }, { name: "b", qty: 1, priceUsd: "10" }], "41.5");
    expect(totalKop(items)).toBe(4 * 41500_00 + 415_00);
  });
  it("форматує з нерозривним пробілом", () => {
    expect(formatKop(92865_00)).toBe("92 865,00");
    expect(formatKop(5)).toBe("0,05");
  });
});

describe("нумерація", () => {
  it("починає з 10 щодня окремо для ФОП і типу", async () => {
    const s = new MemoryCounterStore();
    const d = new Date("2026-02-06T10:00:00Z");
    expect(await nextDocNumber(s, "drizhenko", "invoice", d)).toBe("06-02-10");
    expect(await nextDocNumber(s, "drizhenko", "invoice", d)).toBe("06-02-11");
    expect(await nextDocNumber(s, "drizhenko", "waybill", d)).toBe("06-02-10");
    expect(await nextDocNumber(s, "neskhodovskyi", "invoice", d)).toBe("06-02-10");
    expect(await nextDocNumber(s, "drizhenko", "invoice", new Date("2026-02-07T10:00:00Z"))).toBe("07-02-10");
  });
  it("дата за Києвом, а не UTC", () => {
    expect(formatDocNumber(new Date("2026-02-06T23:30:00Z"), 10)).toBe("07-02-10");
    expect(longDate(new Date("2026-10-28T09:00:00Z"))).toBe("28 жовтня 2026 р.");
  });
});
