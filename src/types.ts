export type DocType = "invoice" | "waybill";
export type CounterType = DocType | "warranty";
export type FopId = "neskhodovskyi" | "drizhenko";

export interface Fop {
  id: FopId;
  buttonLabel: string;
  fullName: string;
  taxId: string;
  iban: string;
  bank: string;
  phone?: string;
  signature: string;
}

export interface Item {
  name: string;
  qty: number;
  priceUsd: string;
}

export interface PricedItem {
  name: string;
  qty: number;
  priceKop: number;
  sumKop: number;
}

export interface DocData {
  fop: Fop;
  number: string;
  date: Date;
  items: PricedItem[];
}
