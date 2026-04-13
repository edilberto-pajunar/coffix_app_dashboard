"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import Image from "next/image";
import { useStoreStore } from "../store/useStoreStore";
import { isStoreOpenAt, DayHours, HolidayHours, Store } from "../interface/store";
import { StoreService } from "../service/StoreService";

const DAYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"] as const;
type Day = typeof DAYS[number];

type DayHoursForm = { isOpen: boolean; open: string; close: string };
type StoreEditForm = {
  name: string;
  email: string;
  contactNumber: string;
  location: string;
  address: string;
  imageUrl: string;
  gstNumber: string;
  invoiceText: string;
  printerId: string;
  openingHours: Record<Day, DayHoursForm>;
};

const REQUIRED: (keyof Omit<StoreEditForm, "openingHours">)[] = [
  "name", "email", "contactNumber", "location", "address",
];

type DialogMode = "edit-store" | "add-holiday" | "edit-holiday" | "delete-holiday" | null;

type HolidayForm = {
  date: string;
  title: string;
  description: string;
  isOpen: boolean;
  open: string;
  close: string;
};

const emptyHolidayForm: HolidayForm = {
  date: "",
  title: "",
  description: "",
  isOpen: true,
  open: "08:00",
  close: "17:00",
};

function storeToForm(store: Store): StoreEditForm {
  const openingHours = Object.fromEntries(
    DAYS.map((day) => {
      const h = store.openingHours?.[day];
      return [day, { isOpen: h?.isOpen ?? false, open: h?.open ?? "08:00", close: h?.close ?? "22:00" }];
    }),
  ) as Record<Day, DayHoursForm>;

  return {
    name: store.name ?? "",
    email: store.email ?? "",
    contactNumber: store.contactNumber ?? "",
    location: store.location ?? "",
    address: store.address ?? "",
    imageUrl: store.imageUrl ?? "",
    gstNumber: store.gstNumber ?? "",
    invoiceText: store.invoiceText ?? "",
    printerId: store.printerId ?? "",
    openingHours,
  };
}

export default function StoreDetailPage() {
  const { storeId } = useParams<{ storeId: string }>();
  const router = useRouter();

  const stores = useStoreStore((s) => s.stores);

  const [dialog, setDialog] = useState<DialogMode>(null);
  const [form, setForm] = useState<StoreEditForm | null>(null);
  const [errors, setErrors] = useState<Partial<Record<keyof StoreEditForm, boolean>>>({});
  const [loading, setLoading] = useState(false);

  const [holidayForm, setHolidayForm] = useState<HolidayForm>(emptyHolidayForm);
  const [editingDate, setEditingDate] = useState<string | null>(null);
  const [holidayErrors, setHolidayErrors] = useState<{ date?: boolean }>({});

  const store = stores.find((s) => s.docId === storeId);

  function openEdit() {
    if (!store) return;
    setForm(storeToForm(store));
    setErrors({});
    setDialog("edit-store");
  }

  function closeDialog() {
    setDialog(null);
    setForm(null);
    setErrors({});
    setHolidayForm(emptyHolidayForm);
    setEditingDate(null);
    setHolidayErrors({});
  }

  function openAddHoliday() {
    setHolidayForm(emptyHolidayForm);
    setHolidayErrors({});
    setEditingDate(null);
    setDialog("add-holiday");
  }

  function openEditHoliday(dateKey: string, entry: HolidayHours) {
    setHolidayForm({
      date: dateKey,
      title: entry.title ?? "",
      description: entry.description ?? "",
      isOpen: entry.isOpen ?? true,
      open: entry.open ?? "08:00",
      close: entry.close ?? "17:00",
    });
    setHolidayErrors({});
    setEditingDate(dateKey);
    setDialog("edit-holiday");
  }

  function openDeleteHoliday(dateKey: string) {
    setEditingDate(dateKey);
    setDialog("delete-holiday");
  }

  async function handleSaveHoliday() {
    if (!store) return;
    if (!holidayForm.date) {
      setHolidayErrors({ date: true });
      return;
    }

    const entry: HolidayHours = {
      isOpen: holidayForm.isOpen,
      ...(holidayForm.title.trim() && { title: holidayForm.title.trim() }),
      ...(holidayForm.description.trim() && { description: holidayForm.description.trim() }),
      ...(holidayForm.isOpen && { open: holidayForm.open, close: holidayForm.close }),
    };

    const updatedMap: Record<string, HolidayHours> = { ...store.holidayHours };

    // If editing and date key changed, remove the old key
    if (editingDate && editingDate !== holidayForm.date) {
      delete updatedMap[editingDate];
    }
    updatedMap[holidayForm.date] = entry;

    setLoading(true);
    try {
      await StoreService.updateStore(store.docId, { holidayHours: updatedMap });
      toast.success(editingDate ? "Holiday updated." : "Holiday added.");
      closeDialog();
    } catch (err) {
      console.error(err);
      toast.error("Failed to save holiday. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleDeleteHoliday() {
    if (!store || !editingDate) return;
    const updatedMap: Record<string, HolidayHours> = { ...store.holidayHours };
    delete updatedMap[editingDate];

    setLoading(true);
    try {
      await StoreService.updateStore(store.docId, { holidayHours: updatedMap });
      toast.success("Holiday removed.");
      closeDialog();
    } catch (err) {
      console.error(err);
      toast.error("Failed to delete holiday. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  function setField<K extends keyof Omit<StoreEditForm, "openingHours">>(key: K, value: string) {
    setForm((f) => f ? { ...f, [key]: value } : f);
    setErrors((e) => ({ ...e, [key]: false }));
  }

  function setDayHours(day: Day, patch: Partial<DayHoursForm>) {
    setForm((f) => f ? ({
      ...f,
      openingHours: { ...f.openingHours, [day]: { ...f.openingHours[day], ...patch } },
    }) : f);
  }

  async function handleUpdate() {
    if (!form || !store) return;

    const newErrors = Object.fromEntries(
      REQUIRED.map((k) => [k, !(form[k] as string).trim()]),
    ) as Partial<Record<keyof StoreEditForm, boolean>>;

    if (Object.values(newErrors).some(Boolean)) {
      setErrors(newErrors);
      toast.error("Please fill in all required fields.");
      return;
    }

    const openingHours: Record<string, DayHours> = Object.fromEntries(
      DAYS.map((day) => {
        const { isOpen, open, close } = form.openingHours[day];
        return [day, { isOpen, open, close }];
      }),
    );

    setLoading(true);
    try {
      await StoreService.updateStore(store.docId, {
        name: form.name.trim(),
        email: form.email.trim(),
        contactNumber: form.contactNumber.trim(),
        location: form.location.trim(),
        address: form.address.trim(),
        imageUrl: form.imageUrl.trim() || undefined,
        gstNumber: form.gstNumber.trim() || undefined,
        invoiceText: form.invoiceText.trim() || undefined,
        printerId: form.printerId.trim() || undefined,
        openingHours,
      });
      toast.success("Store updated successfully.");
      closeDialog();
    } catch (err) {
      console.error(err);
      toast.error("Failed to update store. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  if (!store) {
    return (
      <div className="flex h-64 items-center justify-center text-light-grey">
        Store not found.
      </div>
    );
  }

  const isOpen = isStoreOpenAt(store);
  const isDisabled = store.disable ?? false;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <button
            onClick={() => router.push("/dashboard/stores")}
            className="mb-2 text-xs text-light-grey hover:text-black"
          >
            ← Back to Stores
          </button>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold text-black">{store.name ?? "—"}</h1>
            {isDisabled ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-black px-2.5 py-1 text-xs font-medium text-white">
                <span className="h-1.5 w-1.5 rounded-full bg-white" />
                Disabled
              </span>
            ) : isOpen ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-green-50 px-2.5 py-1 text-xs font-medium text-success">
                <span className="h-1.5 w-1.5 rounded-full bg-success" />
                Open Now
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-black px-2.5 py-1 text-xs font-medium text-white">
                <span className="h-1.5 w-1.5 rounded-full bg-white" />
                Closed
              </span>
            )}
          </div>
        </div>
        <button
          onClick={openEdit}
          className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-black transition-colors hover:border-primary hover:text-primary"
        >
          Edit
        </button>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Store Info Card */}
        <div className="overflow-hidden rounded-xl border border-border bg-white shadow-(--shadow)">
          {store.imageUrl ? (
            <Image
              src={store.imageUrl}
              alt={store.name ?? "Store"}
              width={600}
              height={200}
              className="h-44 w-full object-cover"
            />
          ) : (
            <div className="flex h-44 items-center justify-center bg-primary text-5xl font-bold text-white">
              {(store.name ?? "?")[0].toUpperCase()}
            </div>
          )}
          <div className="divide-y divide-border">
            {[
              { label: "Email", value: store.email },
              { label: "Contact", value: store.contactNumber },
              { label: "Location", value: store.location },
              { label: "Address", value: store.address },
              { label: "GST Number", value: store.gstNumber },
              { label: "Invoice Text", value: store.invoiceText },
              { label: "Printer ID", value: store.printerId },
            ].map(({ label, value }) => (
              <div key={label} className="flex items-center justify-between px-4 py-3">
                <span className="text-xs text-light-grey">{label}</span>
                <span className="text-sm text-black">{value ?? "—"}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Opening Hours Card */}
        <div className="overflow-hidden rounded-xl border border-border bg-white shadow-(--shadow)">
          <div className="border-b border-border px-4 py-3">
            <h2 className="font-semibold text-black">Opening Hours</h2>
          </div>
          <div className="divide-y divide-border">
            {DAYS.map((day) => {
              const h = store.openingHours?.[day];
              const dayOpen = h?.isOpen ?? false;
              return (
                <div key={day} className={`flex items-center justify-between px-4 py-3 ${!dayOpen ? "opacity-40" : ""}`}>
                  <span className="w-28 text-sm font-medium capitalize text-black">{day}</span>
                  {dayOpen ? (
                    <span className="text-sm text-black">
                      {h?.open ?? "—"} – {h?.close ?? "—"}
                    </span>
                  ) : (
                    <span className="text-xs text-light-grey">Closed</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Special Operating Hours Card */}
      {(() => {
        const today = new Date().toLocaleDateString("en-CA");
        const entries = Object.entries(store.holidayHours ?? {}).sort(([a], [b]) => a.localeCompare(b));
        const upcoming = entries.filter(([d]) => d >= today);
        const past = entries.filter(([d]) => d < today);
        const sorted = [...upcoming, ...past];

        return (
          <div className="overflow-hidden rounded-xl border border-border bg-white shadow-(--shadow)">
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <h2 className="font-semibold text-black">Special Operating Hours</h2>
              <button
                onClick={openAddHoliday}
                className="rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-white transition-opacity hover:opacity-80"
              >
                + Add Holiday
              </button>
            </div>
            {sorted.length === 0 ? (
              <p className="px-4 py-6 text-center text-sm text-light-grey">No Special Operating Hours set.</p>
            ) : (
              <div className="divide-y divide-border">
                {sorted.map(([dateKey, entry]) => {
                  const isPast = dateKey < today;
                  const dateLabel = new Date(dateKey + "T00:00:00").toLocaleDateString("en-US", {
                    weekday: "short", year: "numeric", month: "short", day: "numeric",
                  });
                  return (
                    <div key={dateKey} className={`flex items-center justify-between px-4 py-3 ${isPast ? "opacity-40" : ""}`}>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-black">{dateLabel}</span>
                          {isPast && <span className="rounded-full bg-[#f0f0f0] px-2 py-0.5 text-[10px] text-black">Past</span>}
                        </div>
                        {entry.title && <p className="text-xs text-light-grey">{entry.title}{entry.description ? ` — ${entry.description}` : ""}</p>}
                      </div>
                      <div className="ml-4 flex items-center gap-3">
                        {entry.isOpen ? (
                          <span className="text-sm text-black">{entry.open} – {entry.close}</span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-black px-2.5 py-1 text-xs font-medium text-white">
                            <span className="h-1.5 w-1.5 rounded-full bg-white" />
                            Closed
                          </span>
                        )}
                        <button
                          onClick={() => openEditHoliday(dateKey, entry)}
                          className="text-xs text-light-grey hover:text-primary"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => openDeleteHoliday(dateKey)}
                          className="text-xs text-light-grey hover:text-error"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })()}

      {/* Dialogs */}
      {dialog && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={closeDialog}
        >
          <div
            className="w-full max-w-lg rounded-2xl bg-white shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >

          {/* ── Edit Store ── */}
          {dialog === "edit-store" && form && (<>
            <div className="border-b border-border px-6 py-4">
              <h3 className="text-lg font-semibold text-black">Edit Store</h3>
            </div>

            <div className="max-h-[72vh] overflow-y-auto px-6 py-4 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="mb-1.5 block text-xs text-light-grey">Name *</label>
                  <input
                    className={`w-full rounded-lg border px-3 py-2 text-sm text-black outline-none focus:border-primary ${errors.name ? "border-error" : "border-border"}`}
                    value={form.name}
                    onChange={(e) => setField("name", e.target.value)}
                  />
                  {errors.name && <p className="mt-1 text-xs text-error">Required.</p>}
                </div>

                <div>
                  <label className="mb-1.5 block text-xs text-light-grey">Image URL</label>
                  <input
                    className="w-full rounded-lg border border-border px-3 py-2 text-sm text-black outline-none focus:border-primary"
                    value={form.imageUrl}
                    onChange={(e) => setField("imageUrl", e.target.value)}
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-xs text-light-grey">Email *</label>
                  <input
                    type="email"
                    className={`w-full rounded-lg border px-3 py-2 text-sm text-black outline-none focus:border-primary ${errors.email ? "border-error" : "border-border"}`}
                    value={form.email}
                    onChange={(e) => setField("email", e.target.value)}
                  />
                  {errors.email && <p className="mt-1 text-xs text-error">Required.</p>}
                </div>

                <div>
                  <label className="mb-1.5 block text-xs text-light-grey">Contact Number *</label>
                  <input
                    type="tel"
                    className={`w-full rounded-lg border px-3 py-2 text-sm text-black outline-none focus:border-primary ${errors.contactNumber ? "border-error" : "border-border"}`}
                    value={form.contactNumber}
                    onChange={(e) => setField("contactNumber", e.target.value)}
                  />
                  {errors.contactNumber && <p className="mt-1 text-xs text-error">Required.</p>}
                </div>

                <div className="col-span-2">
                  <label className="mb-1.5 block text-xs text-light-grey">Location *</label>
                  <input
                    className={`w-full rounded-lg border px-3 py-2 text-sm text-black outline-none focus:border-primary ${errors.location ? "border-error" : "border-border"}`}
                    value={form.location}
                    onChange={(e) => setField("location", e.target.value)}
                  />
                  {errors.location && <p className="mt-1 text-xs text-error">Required.</p>}
                </div>

                <div className="col-span-2">
                  <label className="mb-1.5 block text-xs text-light-grey">Address *</label>
                  <input
                    className={`w-full rounded-lg border px-3 py-2 text-sm text-black outline-none focus:border-primary ${errors.address ? "border-error" : "border-border"}`}
                    value={form.address}
                    onChange={(e) => setField("address", e.target.value)}
                  />
                  {errors.address && <p className="mt-1 text-xs text-error">Required.</p>}
                </div>

                <div>
                  <label className="mb-1.5 block text-xs text-light-grey">GST Number</label>
                  <input
                    className="w-full rounded-lg border border-border px-3 py-2 text-sm text-black outline-none focus:border-primary"
                    value={form.gstNumber}
                    onChange={(e) => setField("gstNumber", e.target.value)}
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-xs text-light-grey">Invoice Text</label>
                  <input
                    className="w-full rounded-lg border border-border px-3 py-2 text-sm text-black outline-none focus:border-primary"
                    value={form.invoiceText}
                    onChange={(e) => setField("invoiceText", e.target.value)}
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-xs text-light-grey">Printer ID</label>
                  <input
                    className="w-full rounded-lg border border-border px-3 py-2 text-sm text-black outline-none focus:border-primary"
                    value={form.printerId}
                    onChange={(e) => setField("printerId", e.target.value)}
                  />
                </div>
              </div>

              {/* Opening Hours */}
              <div>
                <p className="mb-2 text-xs font-medium uppercase tracking-wide text-light-grey">Opening Hours</p>
                <div className="overflow-hidden rounded-lg border border-border">
                  {DAYS.map((day, i) => {
                    const hours = form.openingHours[day];
                    return (
                      <div
                        key={day}
                        className={`flex items-center gap-3 px-3 py-2.5 ${i !== DAYS.length - 1 ? "border-b border-border" : ""} ${!hours.isOpen ? "opacity-50" : ""}`}
                      >
                        <label className="flex w-28 shrink-0 cursor-pointer items-center gap-2 text-sm font-medium capitalize text-black">
                          <input
                            type="checkbox"
                            checked={hours.isOpen}
                            onChange={(e) => setDayHours(day, { isOpen: e.target.checked })}
                            className="accent-primary"
                          />
                          {day}
                        </label>
                        <input
                          type="time"
                          disabled={!hours.isOpen}
                          value={hours.open}
                          onChange={(e) => setDayHours(day, { open: e.target.value })}
                          className="rounded-md border border-border px-2 py-1 text-xs text-black outline-none focus:border-primary disabled:cursor-not-allowed"
                        />
                        <span className="text-xs text-light-grey">to</span>
                        <input
                          type="time"
                          disabled={!hours.isOpen}
                          value={hours.close}
                          onChange={(e) => setDayHours(day, { close: e.target.value })}
                          className="rounded-md border border-border px-2 py-1 text-xs text-black outline-none focus:border-primary disabled:cursor-not-allowed"
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 border-t border-border px-6 py-4">
              <button
                onClick={closeDialog}
                className="rounded-lg border border-border px-4 py-2 text-sm text-black hover:bg-[#f0f0f0]"
              >
                Cancel
              </button>
              <button
                onClick={handleUpdate}
                disabled={loading}
                className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:opacity-80 disabled:opacity-50"
              >
                {loading ? "Saving…" : "Save Changes"}
              </button>
            </div>
          </>)}

          {/* ── Add / Edit Holiday ── */}
          {(dialog === "add-holiday" || dialog === "edit-holiday") && (
            <>
              <div className="border-b border-border px-6 py-4">
                <h3 className="text-lg font-semibold text-black">
                  {dialog === "add-holiday" ? "Add Holiday" : "Edit Holiday"}
                </h3>
              </div>
              <div className="px-6 py-4 space-y-4">
                <div>
                  <label className="mb-1.5 block text-xs text-light-grey">Date *</label>
                  <input
                    type="date"
                    className={`w-full rounded-lg border px-3 py-2 text-sm text-black outline-none focus:border-primary ${holidayErrors.date ? "border-error" : "border-border"}`}
                    value={holidayForm.date}
                    onChange={(e) => { setHolidayForm((f) => ({ ...f, date: e.target.value })); setHolidayErrors({}); }}
                  />
                  {holidayErrors.date && <p className="mt-1 text-xs text-error">Date is required.</p>}
                </div>
                <div>
                  <label className="mb-1.5 block text-xs text-light-grey">Title</label>
                  <input
                    className="w-full rounded-lg border border-border px-3 py-2 text-sm text-black outline-none focus:border-primary"
                    placeholder="e.g. Good Friday"
                    value={holidayForm.title}
                    onChange={(e) => setHolidayForm((f) => ({ ...f, title: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs text-light-grey">Description</label>
                  <input
                    className="w-full rounded-lg border border-border px-3 py-2 text-sm text-black outline-none focus:border-primary"
                    placeholder="e.g. Reduced hours for public holiday"
                    value={holidayForm.description}
                    onChange={(e) => setHolidayForm((f) => ({ ...f, description: e.target.value }))}
                  />
                </div>
                <label className="flex cursor-pointer items-center gap-2 text-sm text-black">
                  <input
                    type="checkbox"
                    checked={!holidayForm.isOpen}
                    onChange={(e) => setHolidayForm((f) => ({ ...f, isOpen: !e.target.checked }))}
                    className="accent-primary"
                  />
                  Closed all day
                </label>
                {holidayForm.isOpen && (
                  <div className="flex items-center gap-3">
                    <div className="flex-1">
                      <label className="mb-1.5 block text-xs text-light-grey">Open</label>
                      <input
                        type="time"
                        value={holidayForm.open}
                        onChange={(e) => setHolidayForm((f) => ({ ...f, open: e.target.value }))}
                        className="w-full rounded-lg border border-border px-3 py-2 text-sm text-black outline-none focus:border-primary"
                      />
                    </div>
                    <span className="mt-5 text-xs text-light-grey">to</span>
                    <div className="flex-1">
                      <label className="mb-1.5 block text-xs text-light-grey">Close</label>
                      <input
                        type="time"
                        value={holidayForm.close}
                        onChange={(e) => setHolidayForm((f) => ({ ...f, close: e.target.value }))}
                        className="w-full rounded-lg border border-border px-3 py-2 text-sm text-black outline-none focus:border-primary"
                      />
                    </div>
                  </div>
                )}
              </div>
              <div className="flex justify-end gap-2 border-t border-border px-6 py-4">
                <button
                  onClick={closeDialog}
                  className="rounded-lg border border-border px-4 py-2 text-sm text-black hover:bg-[#f0f0f0]"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveHoliday}
                  disabled={loading}
                  className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:opacity-80 disabled:opacity-50"
                >
                  {loading ? "Saving…" : dialog === "add-holiday" ? "Add Holiday" : "Save Changes"}
                </button>
              </div>
            </>
          )}

          {/* ── Delete Holiday ── */}
          {dialog === "delete-holiday" && editingDate && (
            <>
              <div className="border-b border-border px-6 py-4">
                <h3 className="text-lg font-semibold text-black">Remove Holiday</h3>
              </div>
              <div className="px-6 py-4">
                <p className="text-sm text-black">
                  Remove the holiday entry for{" "}
                  <span className="font-medium">
                    {new Date(editingDate + "T00:00:00").toLocaleDateString("en-US", {
                      weekday: "short", year: "numeric", month: "short", day: "numeric",
                    })}
                  </span>
                  {store.holidayHours?.[editingDate]?.title && (
                    <> ({store.holidayHours[editingDate].title})</>
                  )}
                  ?
                </p>
              </div>
              <div className="flex justify-end gap-2 border-t border-border px-6 py-4">
                <button
                  onClick={closeDialog}
                  className="rounded-lg border border-border px-4 py-2 text-sm text-black hover:bg-[#f0f0f0]"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeleteHoliday}
                  disabled={loading}
                  className="rounded-lg bg-error px-4 py-2 text-sm font-medium text-white hover:opacity-80 disabled:opacity-50"
                >
                  {loading ? "Removing…" : "Remove"}
                </button>
              </div>
            </>
          )}

          </div>
        </div>
      )}
    </div>
  );
}
