export interface DayHours {
  isOpen?: boolean;
  open?: string; // "06:30"
  close?: string; // "14:30"
}

export interface Store {
  address?: string;
  disable?: boolean;
  docId: string;
  gstNumber?: string | null;
  imageUrl?: string | null;
  invoiceText?: string | null;
  location?: string;
  name?: string;
  openingHours?: Record<string, DayHours>;
  storeCode?: string;
  email?: string;
  contactNumber?: string;
  printerId?: string;
}

export function isStoreOpenAt(store: Store, dt: Date = new Date()): boolean {
  const key = weekdayKey(dt.getDay());
  const hours = store.openingHours?.[key];
  if (!hours || hours.isOpen === false) return false;
  return dayHoursContains(hours, dt);
}

export function weekdayKey(day: number): string {
  const map: Record<number, string> = {
    0: "sunday",
    1: "monday",
    2: "tuesday",
    3: "wednesday",
    4: "thursday",
    5: "friday",
    6: "saturday",
  };

  return map[day];
}

export function dayHoursContains(hours: DayHours, dt: Date): boolean {
  if (hours.isOpen === false || !hours.open || !hours.close) return false;

  const nowMinutes = dt.getHours() * 60 + dt.getMinutes();
  const openMinutes = toMinutes(hours.open);
  const closeMinutes = toMinutes(hours.close);

  if (closeMinutes > openMinutes) {
    return nowMinutes >= openMinutes && nowMinutes < closeMinutes;
  }

  // Overnight shift support
  return nowMinutes >= openMinutes || nowMinutes < closeMinutes;
}

function toMinutes(hhmm: string): number {
  const [hour, minute] = hhmm.split(":").map(Number);
  return hour * 60 + minute;
}
