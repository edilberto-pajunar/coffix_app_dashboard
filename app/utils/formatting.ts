export const formatDocId = (name: string) => {
  return name.trim().toUpperCase().replace(/\s+/g, "_");
};

export const formatCurrencyInput = (value: string): string => {
  const num = parseFloat(value);
  if (isNaN(num)) return "0.00";
  return num.toFixed(2);
};

export const stripCurrencySymbol = (value: string): string => {
  return value.replace(/^\$/, "");
};

export const toDateSafe = (value: unknown): Date | undefined => {
  if (value === undefined || value === null) return undefined;
  // Firestore Timestamp instance
  if (typeof (value as { toDate?: () => Date }).toDate === "function") {
    const d = (value as { toDate: () => Date }).toDate();
    return isNaN(d.getTime()) ? undefined : d;
  }
  // Real Date
  if (value instanceof Date) {
    return isNaN(value.getTime()) ? undefined : value;
  }
  // Serialized Timestamp: { seconds, nanoseconds } or { _seconds, _nanoseconds }
  if (typeof value === "object") {
    const o = value as { seconds?: number; _seconds?: number };
    const seconds = o.seconds ?? o._seconds;
    if (typeof seconds === "number") {
      const d = new Date(seconds * 1000);
      return isNaN(d.getTime()) ? undefined : d;
    }
    return undefined;
  }
  // ISO string / number
  if (typeof value === "string" || typeof value === "number") {
    const d = new Date(value);
    return isNaN(d.getTime()) ? undefined : d;
  }
  return undefined;
};

// All timestamp-based formatting is pinned to New Zealand time so values look
// the same for every viewer regardless of their machine timezone. NZDT/NZST is
// handled automatically by the IANA zone.
const NZ_TIME_ZONE = "Pacific/Auckland";

// Extracts the calendar/clock parts of an instant as observed in NZ.
const nzParts = (date: Date) => {
  const parts = new Intl.DateTimeFormat("en-NZ", {
    timeZone: NZ_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  // en-NZ hour12:false yields "24" for midnight; normalise to "00".
  const hour = get("hour") === "24" ? 0 : Number(get("hour"));
  return {
    day: get("day"),
    month: get("month"),
    year: get("year"),
    hours: hour,
    minutes: get("minute"),
  };
};

export const formatDate = (value: unknown): string => {
  if (!value) return "—";
  let date: Date | null = null;
  if (value instanceof Date) {
    date = value;
  } else if (typeof value === "object" && value !== null && "seconds" in value) {
    date = new Date((value as { seconds: number }).seconds * 1000);
  }
  if (!date || isNaN(date.getTime())) return "—";
  const { day, month, year } = nzParts(date);
  return `${day}/${month}/${year}`;
};

// Same calendar date as formatDate, but in the yyyy-MM-dd shape required by
// <input type="date">.
export const toNZDateInputValue = (value: unknown): string => {
  const date = toDateSafe(value);
  if (!date) return "";
  const { day, month, year } = nzParts(date);
  return `${year}-${month}-${day}`;
};

// Converts a yyyy-MM-dd date-input string into the Date instant representing
// 23:59:59.999 in NZ time on that calendar date, matching the timezone every
// other formatter in this file uses for display.
export const endOfDayNZ = (dateStr: string): Date => {
  const [year, month, day] = dateStr.split("-").map(Number);
  // Start from the instant that is that calendar date at UTC midnight, then
  // find the NZ UTC offset that applies around it and adjust.
  const utcGuess = new Date(Date.UTC(year, month - 1, day, 23, 59, 59, 999));
  const offsetParts = new Intl.DateTimeFormat("en-US", {
    timeZone: NZ_TIME_ZONE,
    timeZoneName: "shortOffset",
  }).formatToParts(utcGuess);
  const offsetLabel = offsetParts.find((p) => p.type === "timeZoneName")?.value ?? "GMT+12";
  const match = offsetLabel.match(/GMT([+-])(\d{1,2})(?::(\d{2}))?/);
  const sign = match?.[1] === "-" ? -1 : 1;
  const offsetHours = match ? Number(match[2]) : 12;
  const offsetMinutes = match?.[3] ? Number(match[3]) : 0;
  const offsetMs = sign * (offsetHours * 60 + offsetMinutes) * 60 * 1000;
  return new Date(Date.UTC(year, month - 1, day, 23, 59, 59, 999) - offsetMs);
};



export const formatTime = (value: unknown): string => {
  if (!value) return "—";
  // Plain "HH:MM" wall-clock strings (e.g. store opening hours) are not an
  // instant in time, so they must be rendered as-is without timezone shifting.
  if (typeof value === "string" && /^\d{1,2}:\d{2}$/.test(value)) {
    const [h, m] = value.split(":").map(Number);
    const ampm = h >= 12 ? "PM" : "AM";
    const hour12 = String(h % 12 || 12).padStart(2, "0");
    return `${hour12}:${String(m).padStart(2, "0")} ${ampm}`;
  }
  let date: Date | null = null;
  if (value instanceof Date) {
    date = value;
  } else if (typeof value === "object" && value !== null && "seconds" in value) {
    date = new Date((value as { seconds: number }).seconds * 1000);
  }
  if (!date || isNaN(date.getTime())) return "—";
  const { hours, minutes } = nzParts(date);
  const ampm = hours >= 12 ? "PM" : "AM";
  const hour12 = String(hours % 12 || 12).padStart(2, "0");
  return `${hour12}:${minutes} ${ampm}`;
};

export const formatDateTime = (value: unknown): string => {
  if (!value) return "—";
  let date: Date | null = null;
  if (value instanceof Date) {
    date = value;
  } else if (typeof value === "object" && value !== null && "seconds" in value) {
    date = new Date((value as { seconds: number }).seconds * 1000);
  }
  if (!date || isNaN(date.getTime())) return "—";
  const { day, month, year, hours, minutes } = nzParts(date);
  const ampm = hours >= 12 ? "PM" : "AM";
  const hour12 = String(hours % 12 || 12).padStart(2, "0");
  return `${day}-${month}-${year} ${hour12}:${minutes} ${ampm}`;
};
