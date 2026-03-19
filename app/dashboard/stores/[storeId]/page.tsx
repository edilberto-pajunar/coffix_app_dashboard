"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import Image from "next/image";
import { useStoreStore } from "../store/useStoreStore";
import { isStoreOpenAt, DayHours, Store } from "../interface/store";
import { StoreService } from "../service/StoreService";

const DAYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"] as const;
type Day = typeof DAYS[number];

type DayHoursForm = { isOpen: boolean; open: string; close: string };
type StoreEditForm = {
  name: string;
  storeCode: string;
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
  "name", "storeCode", "email", "contactNumber", "location", "address",
];

function storeToForm(store: Store): StoreEditForm {
  const openingHours = Object.fromEntries(
    DAYS.map((day) => {
      const h = store.openingHours?.[day];
      return [day, { isOpen: h?.isOpen ?? false, open: h?.open ?? "08:00", close: h?.close ?? "22:00" }];
    }),
  ) as Record<Day, DayHoursForm>;

  return {
    name: store.name ?? "",
    storeCode: store.storeCode ?? "",
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

  const [showEdit, setShowEdit] = useState(false);
  const [form, setForm] = useState<StoreEditForm | null>(null);
  const [errors, setErrors] = useState<Partial<Record<keyof StoreEditForm, boolean>>>({});
  const [loading, setLoading] = useState(false);

  const store = stores.find((s) => s.docId === storeId);

  function openEdit() {
    if (!store) return;
    setForm(storeToForm(store));
    setErrors({});
    setShowEdit(true);
  }

  function closeEdit() {
    setShowEdit(false);
    setForm(null);
    setErrors({});
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
        storeCode: form.storeCode.trim(),
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
      closeEdit();
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
              <span className="inline-flex items-center gap-1.5 rounded-full bg-disabled-bg px-2.5 py-1 text-xs font-medium text-light-grey">
                <span className="h-1.5 w-1.5 rounded-full bg-light-grey" />
                Disabled
              </span>
            ) : isOpen ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-green-50 px-2.5 py-1 text-xs font-medium text-success">
                <span className="h-1.5 w-1.5 rounded-full bg-success" />
                Open Now
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-soft-grey px-2.5 py-1 text-xs font-medium text-light-grey">
                <span className="h-1.5 w-1.5 rounded-full bg-light-grey" />
                Closed
              </span>
            )}
          </div>
          <p className="mt-1 font-mono text-sm text-light-grey">{store.storeCode ?? "—"}</p>
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
            <div className="flex h-44 items-center justify-center bg-soft-grey text-5xl font-bold text-light-grey">
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

      {/* Edit Dialog */}
      {showEdit && form && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={closeEdit}
        >
          <div
            className="w-full max-w-lg rounded-2xl bg-white shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
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
                  <label className="mb-1.5 block text-xs text-light-grey">Store Code *</label>
                  <input
                    className={`w-full rounded-lg border px-3 py-2 text-sm text-black outline-none focus:border-primary ${errors.storeCode ? "border-error" : "border-border"}`}
                    value={form.storeCode}
                    onChange={(e) => setField("storeCode", e.target.value)}
                  />
                  {errors.storeCode && <p className="mt-1 text-xs text-error">Required.</p>}
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
                onClick={closeEdit}
                className="rounded-lg border border-border px-4 py-2 text-sm text-black hover:bg-soft-grey"
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
          </div>
        </div>
      )}
    </div>
  );
}
