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

export const formatDate = (value: unknown): string => {
  if (!value) return "—";
  let date: Date | null = null;
  if (value instanceof Date) {
    date = value;
  } else if (typeof value === "object" && value !== null && "seconds" in value) {
    date = new Date((value as { seconds: number }).seconds * 1000);
  }
  if (!date || isNaN(date.getTime())) return "—";
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
};



export const formatTime = (value: unknown): string => {
  if (!value) return "—";
  let date: Date | null = null;
  if (value instanceof Date) {
    date = value;
  } else if (typeof value === "object" && value !== null && "seconds" in value) {
    date = new Date((value as { seconds: number }).seconds * 1000);
  } else if (typeof value === "string" && /^\d{1,2}:\d{2}$/.test(value)) {
    const [h, m] = value.split(":").map(Number);
    const d = new Date();
    d.setHours(h, m, 0, 0);
    date = d;
  }
  if (!date || isNaN(date.getTime())) return "—";
  const hours = date.getHours();
  const minutes = String(date.getMinutes()).padStart(2, "0");
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
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();
  const hours = date.getHours();
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const ampm = hours >= 12 ? "PM" : "AM";
  const hour12 = String(hours % 12 || 12).padStart(2, "0");
  return `${day}/${month}/${year} ${hour12}:${minutes} ${ampm}`;
};
