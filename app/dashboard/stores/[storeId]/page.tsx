"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import Image from "next/image";
import { useStoreStore } from "../store/useStoreStore";
import { useAuth } from "@/app/lib/AuthContext";
import { isStoreOpenAt, DayHours, HolidayHours, Store, parseLocation, formatLocation, isValidCoordinate, isStoreFieldTaken } from "../interface/store";
import { StoreService } from "../service/StoreService";
import { useDashboardStore } from "../../products/store/useDashboardStore";
import { productIdsReferencingStore } from "../../products/interface/product";
import { formatTime } from "@/app/utils/formatting";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ImageUploadField } from "@/components/components/ImageUploadField";
import { useActivityLog } from "../../logs/hooks/useActivityLog";
import { LOG_CATEGORY, LOG_PAGE, LOG_SEVERITY } from "../../logs/constants/logConstants";

const DAYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"] as const;
type Day = typeof DAYS[number];

type DayHoursForm = { isOpen: boolean; open: string; close: string };
type StoreEditForm = {
  name: string;
  email: string;
  contactNumber: string;
  lat: string;
  lng: string;
  address: string;
  city: string;
  imageUrl: string;
  gstNumber: string;
  invoiceText: string;
  printerId: string;
  storeCode: string;
  openingHours: Record<Day, DayHoursForm>;
};

const REQUIRED: (keyof Omit<StoreEditForm, "openingHours">)[] = [
  "name", "email", "contactNumber", "address", "printerId",
  "gstNumber", "invoiceText", "storeCode",
];

/** Per-field error message; absent means no error. */
type FieldErrors = Partial<Record<keyof StoreEditForm, string>>;

type DialogMode = "edit-store" | "edit-hours" | "add-holiday" | "edit-holiday" | "delete-holiday" | "delete-store" | null;

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

  const { lat, lng } = parseLocation(store.location);

  return {
    name: store.name ?? "",
    email: store.email ?? "",
    contactNumber: store.contactNumber ?? "",
    lat,
    lng,
    address: store.address ?? "",
    city: store.city ?? "",
    imageUrl: store.imageUrl ?? "",
    gstNumber: store.gstNumber ?? "",
    invoiceText: store.invoiceText ?? "",
    printerId: store.printerId ?? "",
    storeCode: store.storeCode ?? "",
    openingHours,
  };
}

export default function StoreDetailPage() {
  const { storeId } = useParams<{ storeId: string }>();
  const router = useRouter();

  const { currentStaff } = useAuth();
  const isAdmin = currentStaff?.role === "admin";
  const myStoreIds = currentStaff?.storeIds ?? [];
  const canAccess = isAdmin || myStoreIds.includes(storeId);

  const { log } = useActivityLog();
  // Hours and holiday hours are reachable by both roles; edit/delete are admin-only.
  const actor = isAdmin ? "Admin" : "Store manager";

  const stores = useStoreStore((s) => s.stores);

  const [dialog, setDialog] = useState<DialogMode>(null);
  const [form, setForm] = useState<StoreEditForm | null>(null);
  const [errors, setErrors] = useState<FieldErrors>({});
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

  function openEditHours() {
    if (!store) return;
    setForm(storeToForm(store));
    setErrors({});
    setDialog("edit-hours");
  }

  async function handleSaveHours() {
    if (!form || !store) return;

    const openingHours: Record<string, DayHours> = Object.fromEntries(
      DAYS.map((day) => {
        const { isOpen, open, close } = form.openingHours[day];
        return [day, { isOpen, open, close }];
      }),
    );

    setLoading(true);
    try {
      await StoreService.updateStore(store.docId, { openingHours });
      log({
        category: LOG_CATEGORY.STORES,
        severityLevel: LOG_SEVERITY.HIGH,
        action: "Edit Opening Hours",
        notes: `${actor} edited Opening hours for ${store.name ?? ""}`,
        page: LOG_PAGE.STORES,
      });
      toast.success("Opening hours updated.");
      closeDialog();
    } catch (err) {
      console.error(err);
      toast.error("Failed to update opening hours. Please try again.");
    } finally {
      setLoading(false);
    }
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

    // Captured before closeDialog() resets them.
    const isEditing = editingDate !== null;
    const holidayDate = holidayForm.date;

    setLoading(true);
    try {
      await StoreService.updateStore(store.docId, { holidayHours: updatedMap });
      log({
        category: LOG_CATEGORY.STORES,
        severityLevel: LOG_SEVERITY.HIGH,
        action: isEditing ? "Edit Holiday Hours" : "Add Holiday Hours",
        notes: `${actor} ${isEditing ? "edited" : "added"} special operating hours for ${store.name ?? ""} on ${holidayDate}`,
        page: LOG_PAGE.STORES,
      });
      toast.success(isEditing ? "Holiday updated." : "Holiday added.");
      closeDialog();
    } catch (err) {
      console.error(err);
      toast.error("Failed to save holiday. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleDeleteStore() {
    if (!store) return;
    setLoading(true);
    const affectedProductIds = productIdsReferencingStore(
      useDashboardStore.getState().products,
      store.docId,
    );
    try {
      await StoreService.deleteStoreCascade(store.docId, affectedProductIds);
      log({
        category: LOG_CATEGORY.STORES,
        severityLevel: LOG_SEVERITY.HIGH,
        action: "Delete Store",
        notes: `Admin deleted a store ${store.name ?? ""}`,
        page: LOG_PAGE.STORES,
      });
      toast.success("Store deleted.");
      router.push("/dashboard/stores");
    } catch (err) {
      console.error(err);
      toast.error("Failed to delete store. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleDeleteHoliday() {
    if (!store || !editingDate) return;
    const updatedMap: Record<string, HolidayHours> = { ...store.holidayHours };
    delete updatedMap[editingDate];

    // Captured before closeDialog() resets it.
    const holidayDate = editingDate;

    setLoading(true);
    try {
      await StoreService.updateStore(store.docId, { holidayHours: updatedMap });
      log({
        category: LOG_CATEGORY.STORES,
        severityLevel: LOG_SEVERITY.HIGH,
        action: "Delete Holiday Hours",
        notes: `${actor} deleted special operating hours for ${store.name ?? ""} on ${holidayDate}`,
        page: LOG_PAGE.STORES,
      });
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
    setErrors((e) => ({ ...e, [key]: undefined }));
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
      REQUIRED.filter((k) => !(form[k] as string).trim()).map((k) => [k, "Required."]),
    ) as FieldErrors;

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      toast.error("Please fill in all required fields.");
      return;
    }

    // Exclude this store so unchanged values don't collide with themselves.
    const dupErrors: FieldErrors = {};
    if (isStoreFieldTaken(stores, "name", form.name, store.docId)) {
      dupErrors.name = "This store name is already in use.";
    }
    if (isStoreFieldTaken(stores, "storeCode", form.storeCode, store.docId)) {
      dupErrors.storeCode = "This store code is already in use.";
    }
    if (isStoreFieldTaken(stores, "printerId", form.printerId, store.docId)) {
      dupErrors.printerId = "This printer ID is already in use.";
    }
    if (Object.keys(dupErrors).length > 0) {
      setErrors(dupErrors);
      toast.error("Name, store code, and printer ID must be unique.");
      return;
    }

    const latInvalid = !isValidCoordinate(form.lat, 90);
    const lngInvalid = !isValidCoordinate(form.lng, 180);
    if (latInvalid || lngInvalid) {
      setErrors({
        ...(latInvalid ? { lat: "Enter a number between -90 and 90." } : {}),
        ...(lngInvalid ? { lng: "Enter a number between -180 and 180." } : {}),
      });
      toast.error("Please enter a valid latitude and longitude.");
      return;
    }

    setErrors({});

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
        location: formatLocation(form.lat, form.lng),
        address: form.address.trim(),
        city: form.city.trim() || null,
        ...(form.imageUrl.trim() ? { imageUrl: form.imageUrl.trim() } : { imageUrl: "" }),
        gstNumber: form.gstNumber.trim(),
        invoiceText: form.invoiceText.trim(),
        printerId: form.printerId.trim(),
        storeCode: form.storeCode.trim(),
        openingHours,
      });
      log({
        category: LOG_CATEGORY.STORES,
        severityLevel: LOG_SEVERITY.HIGH,
        action: "Edit Store",
        notes: `Admin edited store ${form.name.trim()} contact/address/GST info`,
        page: LOG_PAGE.STORES,
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

  if (!store || !canAccess) {
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
          <Button
            onClick={() => router.push("/dashboard/stores")}
            variant="outline"
            size="sm"
          >
            ← Back to Stores
          </Button>
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
        {isAdmin && (
          <div className="flex gap-2">
            <Button
              variant="destructive"
              onClick={() => setDialog("delete-store")}
            >
              Delete
            </Button>
            <Button
              onClick={openEdit}
              variant="outline"
            >
              Edit
            </Button>
          </div>
        )}
      </div>

      {/* Store image — square to match 1200×1200 mobile app asset */}
      {store.imageUrl ? (
        <div className="relative h-48 w-48 overflow-hidden rounded-xl">
          <Image
            src={store.imageUrl}
            alt={store.name ?? "Store"}
            fill
            sizes="192px"
            className="object-cover"
          />
        </div>
      ) : (
        <div className="flex h-48 w-48 items-center justify-center rounded-xl bg-primary text-4xl font-bold text-white">
          {(store.name ?? "?")[0].toUpperCase()}
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Store Info Card */}
        <div className="overflow-hidden rounded-xl border border-border bg-white shadow-(--shadow)">
          <div className="divide-y divide-border">
            {[
              { label: "Email", value: store.email },
              { label: "Contact", value: store.contactNumber },
              { label: "Location", value: store.location },
              { label: "Address", value: store.address },
              { label: "City", value: store.city },
              { label: "GST Number", value: store.gstNumber },
              { label: "Invoice Text", value: store.invoiceText },
              { label: "Printer ID", value: store.printerId },
              { label: "Store Code", value: store.storeCode },
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
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <h2 className="font-semibold text-black">Opening Hours</h2>
            <Button onClick={openEditHours} variant="outline" size="sm">
              Edit Hours
            </Button>
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
              <Button
                onClick={openAddHoliday}
              >
                + Add Holiday
              </Button>
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
                    <div
                      key={dateKey}
                      className={`flex cursor-pointer items-center justify-between px-4 py-3 transition-colors hover:bg-muted/50 ${isPast ? "opacity-90" : ""}`}
                      onClick={() => openEditHoliday(dateKey, entry)}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-black">{dateLabel}</span>
                          {isPast && <span className="rounded-full bg-[#f0f0f0] px-2 py-0.5 text-[10px] text-black">Past</span>}
                        </div>
                        {entry.title && <p className="text-xs text-light-grey">{entry.title}{(entry.description) ? ` — ${entry.description}` : ""}</p>}
                      </div>
                      <div className="ml-4 flex items-center gap-3">
                        {entry.isOpen ? (
                          <span className="text-sm text-black">{formatTime(entry.open)} – {formatTime(entry.close)}</span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-black px-2.5 py-1 text-xs font-medium text-white">
                            <span className="h-1.5 w-1.5 rounded-full bg-white" />
                            Closed
                          </span>
                        )}
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={(e) => { e.stopPropagation(); openDeleteHoliday(dateKey); }}
                        >
                          Delete
                        </Button>
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
                  {errors.name && <p className="mt-1 text-xs text-error">{errors.name}</p>}
                </div>

                <div className="col-span-2">
                  <ImageUploadField
                    value={form.imageUrl}
                    onChange={(url) => setField("imageUrl", url)}
                    label="Store Image"
                    disabled={loading}
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
                  {errors.email && <p className="mt-1 text-xs text-error">{errors.email}</p>}
                </div>

                <div>
                  <label className="mb-1.5 block text-xs text-light-grey">Contact Number *</label>
                  <input
                    type="tel"
                    className={`w-full rounded-lg border px-3 py-2 text-sm text-black outline-none focus:border-primary ${errors.contactNumber ? "border-error" : "border-border"}`}
                    value={form.contactNumber}
                    onChange={(e) => setField("contactNumber", e.target.value)}
                  />
                  {errors.contactNumber && <p className="mt-1 text-xs text-error">{errors.contactNumber}</p>}
                </div>

                <div className="col-span-2 grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1.5 block text-xs text-light-grey">Latitude *</label>
                    <input
                      className={`w-full rounded-lg border px-3 py-2 text-sm text-black outline-none focus:border-primary ${errors.lat ? "border-error" : "border-border"}`}
                      placeholder="e.g. 31.00"
                      value={form.lat}
                      onChange={(e) => setField("lat", e.target.value)}
                    />
                    {errors.lat && <p className="mt-1 text-xs text-error">{errors.lat}</p>}
                  </div>

                  <div>
                    <label className="mb-1.5 block text-xs text-light-grey">Longitude *</label>
                    <input
                      className={`w-full rounded-lg border px-3 py-2 text-sm text-black outline-none focus:border-primary ${errors.lng ? "border-error" : "border-border"}`}
                      placeholder="e.g. 33.00"
                      value={form.lng}
                      onChange={(e) => setField("lng", e.target.value)}
                    />
                    {errors.lng && <p className="mt-1 text-xs text-error">{errors.lng}</p>}
                  </div>
                </div>

                <div className="col-span-2">
                  <label className="mb-1.5 block text-xs text-light-grey">Address *</label>
                  <input
                    className={`w-full rounded-lg border px-3 py-2 text-sm text-black outline-none focus:border-primary ${errors.address ? "border-error" : "border-border"}`}
                    value={form.address}
                    onChange={(e) => setField("address", e.target.value)}
                  />
                  {errors.address && <p className="mt-1 text-xs text-error">{errors.address}</p>}
                </div>

                <div className="col-span-2">
                  <label className="mb-1.5 block text-xs text-light-grey">City</label>
                  <input
                    className="w-full rounded-lg border border-border px-3 py-2 text-sm text-black outline-none focus:border-primary"
                    value={form.city}
                    onChange={(e) => setField("city", e.target.value)}
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-xs text-light-grey">GST Number *</label>
                  <input
                    className={`w-full rounded-lg border px-3 py-2 text-sm text-black outline-none focus:border-primary ${errors.gstNumber ? "border-error" : "border-border"}`}
                    value={form.gstNumber}
                    onChange={(e) => setField("gstNumber", e.target.value)}
                  />
                  {errors.gstNumber && <p className="mt-1 text-xs text-error">{errors.gstNumber}</p>}
                </div>

                <div>
                  <label className="mb-1.5 block text-xs text-light-grey">Invoice Text *</label>
                  <input
                    className={`w-full rounded-lg border px-3 py-2 text-sm text-black outline-none focus:border-primary ${errors.invoiceText ? "border-error" : "border-border"}`}
                    value={form.invoiceText}
                    onChange={(e) => setField("invoiceText", e.target.value)}
                  />
                  {errors.invoiceText && <p className="mt-1 text-xs text-error">{errors.invoiceText}</p>}
                </div>

                <div>
                  <label className="mb-1.5 block text-xs text-light-grey">Printer ID *</label>
                  <input
                    className={`w-full rounded-lg border px-3 py-2 text-sm text-black outline-none focus:border-primary ${errors.printerId ? "border-error" : "border-border"}`}
                    value={form.printerId}
                    onChange={(e) => setField("printerId", e.target.value)}
                  />
                  {errors.printerId && <p className="mt-1 text-xs text-error">{errors.printerId}</p>}
                </div>

                <div>
                  <label className="mb-1.5 block text-xs text-light-grey">Store Code *</label>
                  <input
                    className={`w-full rounded-lg border px-3 py-2 text-sm text-black outline-none focus:border-primary ${errors.storeCode ? "border-error" : "border-border"}`}
                    value={form.storeCode}
                    onChange={(e) => setField("storeCode", e.target.value)}
                  />
                  {errors.storeCode && <p className="mt-1 text-xs text-error">{errors.storeCode}</p>}
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
                        <label
                          htmlFor={`edit-day-${day}`}
                          className="flex w-28 shrink-0 cursor-pointer items-center gap-2 text-sm font-medium capitalize text-black"
                        >
                          <Checkbox
                            id={`edit-day-${day}`}
                            checked={hours.isOpen}
                            onCheckedChange={(c) => setDayHours(day, { isOpen: c === true })}
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
              <Button
                variant="outline"
                onClick={closeDialog}
              >
                Cancel
              </Button>
              <Button
                onClick={handleUpdate}
                disabled={loading}
              >
                {loading ? "Saving…" : "Save Changes"}
              </Button>
            </div>
          </>)}

          {/* ── Edit Opening Hours (store managers + admins) ── */}
          {dialog === "edit-hours" && form && (<>
            <div className="border-b border-border px-6 py-4">
              <h3 className="text-lg font-semibold text-black">Edit Opening Hours</h3>
            </div>
            <div className="max-h-[72vh] overflow-y-auto px-6 py-4">
              <div className="overflow-hidden rounded-lg border border-border">
                {DAYS.map((day, i) => {
                  const hours = form.openingHours[day];
                  return (
                    <div
                      key={day}
                      className={`flex items-center gap-3 px-3 py-2.5 ${i !== DAYS.length - 1 ? "border-b border-border" : ""} ${!hours.isOpen ? "opacity-50" : ""}`}
                    >
                      <label
                        htmlFor={`hours-day-${day}`}
                        className="flex w-28 shrink-0 cursor-pointer items-center gap-2 text-sm font-medium capitalize text-black"
                      >
                        <Checkbox
                          id={`hours-day-${day}`}
                          checked={hours.isOpen}
                          onCheckedChange={(c) => setDayHours(day, { isOpen: c === true })}
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
            <div className="flex justify-end gap-2 border-t border-border px-6 py-4">
              <Button variant="outline" onClick={closeDialog}>
                Cancel
              </Button>
              <Button onClick={handleSaveHours} disabled={loading}>
                {loading ? "Saving…" : "Save Hours"}
              </Button>
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
                <label htmlFor="holiday-closed-all-day" className="flex cursor-pointer items-center gap-2 text-sm text-black">
                  <Checkbox
                    id="holiday-closed-all-day"
                    checked={!holidayForm.isOpen}
                    onCheckedChange={(c) => setHolidayForm((f) => ({ ...f, isOpen: c !== true }))}
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
                <Button
                  variant="outline"
                  onClick={closeDialog}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleSaveHoliday}
                  disabled={loading}
                >
                  {loading ? "Saving…" : dialog === "add-holiday" ? "Add Holiday" : "Save Changes"}
                </Button>
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
                <Button
                  onClick={closeDialog}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleDeleteHoliday}
                  disabled={loading}
                >
                  {loading ? "Removing…" : "Remove"}
                </Button>
              </div>
            </>
          )}

          {/* ── Delete Store ── */}
          {dialog === "delete-store" && (
            <>
              <div className="border-b border-border px-6 py-4">
                <h3 className="text-lg font-semibold text-black">Delete Store</h3>
              </div>
              <div className="px-6 py-4">
                <p className="text-sm text-black">
                  Are you sure you want to delete{" "}
                  <span className="font-medium">{store.name}</span>? This action cannot be undone.
                </p>
              </div>
              <div className="flex justify-end gap-2 border-t border-border px-6 py-4">
                <Button variant="outline" onClick={closeDialog} disabled={loading}>
                  Cancel
                </Button>
                <Button variant="destructive" onClick={handleDeleteStore} disabled={loading}>
                  {loading ? "Deleting…" : "Delete Store"}
                </Button>
              </div>
            </>
          )}

          </div>
        </div>
      )}
    </div>
  );
}
