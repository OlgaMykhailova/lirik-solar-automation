import type { Fop, FopId } from "../types.js";

export const FOPS: Record<FopId, Fop> = {
  neskhodovskyi: {
    id: "neskhodovskyi",
    buttonLabel: "ФОП Несходовський",
    fullName: "Несходовський Кирил Сергійович",
    taxId: "2893108313",
    iban: "UA283052990000026004050343631",
    bank: 'АТ КБ "ПРИВАТБАНК"',
    signature: "Несходовський К.С.",
  },
  drizhenko: {
    id: "drizhenko",
    buttonLabel: "ФОП Дриженко",
    fullName: "Дриженко Руслан Віталійович",
    taxId: "2864620769",
    iban: "UA223052990000026007000154576",
    bank: 'АТ КБ "ПРИВАТБАНК"',
    phone: "(067) 240-30-07",
    signature: "Дриженко Р.В.",
  },
};

export const CUSTOMER = "Кінцевий споживач";
export const PLACE = "м. Київ";
