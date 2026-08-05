"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import Image from "next/image";
import { useStoreStore } from "./store/useStoreStore";
import { useAuth } from "@/app/lib/AuthContext";
import { isStoreOpenAt, DayHours, Store, formatLocation, isValidCoordinate, isStoreFieldTaken } from "./interface/store";
import { StoreService } from "./service/StoreService";
import { useActivityLog } from "../logs/hooks/useActivityLog";
import { LOG_CATEGORY, LOG_PAGE, LOG_SEVERITY } from "../logs/constants/logConstants";
import {
  STORE_PROTECTED_FIELDS,
  STORE_IMPORTABLE_FIELDS,
  STORE_EXPORTABLE_FIELDS,
} from "./constants/storeFieldConstants";
import { parseCSVText } from "@/app/utils/csvUtils";
import { exportRowsToCSV } from "@/app/utils/import";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { EnumChip } from "@/components/ui/StatusChip";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { StoresFilterBar } from "./components/StoresFilterBar";
import { ImageUploadField } from "@/components/components/ImageUploadField";

const DAYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"] as const;
type Day = typeof DAYS[number];

type DayHoursForm = {
  isOpen: boolean;
  open: string;
  close: string;
};

type StoreForm = {
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

const defaultDayHours: DayHoursForm = { isOpen: false, open: "08:00", close: "22:00" };

const emptyForm: StoreForm = {
  name: "",
  email: "",
  contactNumber: "",
  lat: "",
  lng: "",
  address: "",
  city: "",
  imageUrl: "",
  gstNumber: "",
  invoiceText: "",
  printerId: "",
  storeCode: "",
  openingHours: Object.fromEntries(DAYS.map((d) => [d, { ...defaultDayHours }])) as Record<Day, DayHoursForm>,
};

const REQUIRED: (keyof Omit<StoreForm, "openingHours">)[] = [
  "name", "email", "contactNumber", "address", "printerId",
  "gstNumber", "invoiceText", "storeCode",
];

/** Per-field error message; absent means no error. */
type FieldErrors = Partial<Record<keyof StoreForm, string>>;

export default function StoresPage() {
  const allStores = useStoreStore((s) => s.stores);
  const router = useRouter();

  const { currentStaff } = useAuth();
  const isAdmin = currentStaff?.role === "admin";
  const { log } = useActivityLog();

  // Store managers only see the stores they're assigned to.
  const stores = useMemo(() => {
    if (isAdmin) return allStores;
    const myStoreIds = currentStaff?.storeIds ?? [];
    return allStores.filter((s) => myStoreIds.includes(s.docId));
  }, [allStores, isAdmin, currentStaff?.storeIds]);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"All" | "Open" | "Closed" | "Disabled">("All");
  const [filterEmail, setFilterEmail] = useState("");
  const [filterContactNumber, setFilterContactNumber] = useState("");
  const [filterLocation, setFilterLocation] = useState("");
  const [filterAddress, setFilterAddress] = useState("");
  const [filterStoreCode, setFilterStoreCode] = useState("");
  const [filterPrinterId, setFilterPrinterId] = useState("");

  type StoreSortKey = "name" | "status";
  type SortDir = "asc" | "desc";
  const [sortKey, setSortKey] = useState<StoreSortKey>("name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  function toggleSort(key: StoreSortKey) {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("asc"); }
  }

  const anyFilterActive = useMemo(() => {
    return (
      search.trim() !== "" ||
      statusFilter !== "All" ||
      filterEmail.trim() !== "" ||
      filterContactNumber.trim() !== "" ||
      filterLocation.trim() !== "" ||
      filterAddress.trim() !== "" ||
      filterStoreCode.trim() !== "" ||
      filterPrinterId.trim() !== ""
    );
  }, [search, statusFilter, filterEmail, filterContactNumber,
      filterLocation, filterAddress, filterStoreCode, filterPrinterId]);

  function clearAllFilters() {
    setSearch("");
    setStatusFilter("All");
    setFilterEmail("");
    setFilterContactNumber("");
    setFilterLocation("");
    setFilterAddress("");
    setFilterStoreCode("");
    setFilterPrinterId("");
  }

  const displayed = useMemo(() => {
    const q = search.trim().toLowerCase();
    let result = stores.filter((s) => {
      if (statusFilter !== "All") {
        const disabled = s.disable ?? false;
        const open = !disabled && isStoreOpenAt(s);
        const storeStatus = disabled ? "Disabled" : open ? "Open" : "Closed";
        if (storeStatus !== statusFilter) return false;
      }
      if (q && !(
        (s.name ?? "").toLowerCase().includes(q) ||
        (s.email ?? "").toLowerCase().includes(q) ||
        (s.contactNumber ?? "").toLowerCase().includes(q)
      )) return false;
      if (filterEmail.trim() && !(s.email ?? "").toLowerCase().includes(filterEmail.trim().toLowerCase())) return false;
      if (filterContactNumber.trim() && !(s.contactNumber ?? "").toLowerCase().includes(filterContactNumber.trim().toLowerCase())) return false;
      if (filterLocation.trim() && !(s.location ?? "").toLowerCase().includes(filterLocation.trim().toLowerCase())) return false;
      if (filterAddress.trim() && !(s.address ?? "").toLowerCase().includes(filterAddress.trim().toLowerCase())) return false;
      if (filterStoreCode.trim() && !(s.storeCode ?? "").toLowerCase().includes(filterStoreCode.trim().toLowerCase())) return false;
      if (filterPrinterId.trim() && !(s.printerId ?? "").toLowerCase().includes(filterPrinterId.trim().toLowerCase())) return false;
      return true;
    });
    result = [...result].sort((a, b) => {
      let cmp = 0;
      if (sortKey === "name") {
        cmp = (a.name ?? "").localeCompare(b.name ?? "");
      } else {
        const getStatus = (s: typeof a) => {
          if (s.disable) return "Disabled";
          return isStoreOpenAt(s) ? "Open" : "Closed";
        };
        cmp = getStatus(a).localeCompare(getStatus(b));
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
    return result;
  }, [stores, search, statusFilter, sortKey, sortDir,
      filterEmail, filterContactNumber, filterLocation,
      filterAddress, filterStoreCode, filterPrinterId]);

  const [deleteStoreId, setDeleteStoreId] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState<StoreForm>(emptyForm);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [loading, setLoading] = useState(false);

  type ImportError = { row: number; field: string; reason: string };
  type ImportPreview = { validRows: Record<string, string>[]; errors: ImportError[] } | null;
  const [importLoading, setImportLoading] = useState(false);
  const [importPreview, setImportPreview] = useState<ImportPreview>(null);
  const [showImportInfo, setShowImportInfo] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function setField<K extends keyof Omit<StoreForm, "openingHours">>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((e) => ({ ...e, [key]: undefined }));
  }

  function setDayHours(day: Day, patch: Partial<DayHoursForm>) {
    setForm((f) => ({
      ...f,
      openingHours: {
        ...f.openingHours,
        [day]: { ...f.openingHours[day], ...patch },
      },
    }));
  }

  function closeDialog() {
    setShowCreate(false);
    setForm(emptyForm);
    setErrors({});
  }

  function exportToCSV() {
    exportRowsToCSV(displayed, STORE_EXPORTABLE_FIELDS, "stores");
  }

  function handleImportCSV(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const text = ev.target?.result as string;
        const { headers, rows } = parseCSVText(text);

        const protectedInFile = headers.filter((h) =>
          (STORE_PROTECTED_FIELDS as readonly string[]).includes(h)
        );
        if (protectedInFile.length > 0) {
          toast.error(`CSV contains protected columns: ${protectedInFile.join(", ")}. Remove them and re-upload.`);
          if (fileInputRef.current) fileInputRef.current.value = "";
          return;
        }

        const existingStores = useStoreStore.getState().stores;
        const existingStoreIds = existingStores.map((s) => s.docId);
        const validImportCols = new Set([...(STORE_IMPORTABLE_FIELDS as readonly string[]), "docId"]);

        const validRows: Record<string, string>[] = [];
        const errors: ImportError[] = [];

        // Values claimed by earlier rows in this file, so the import can't
        // introduce duplicates among its own rows either.
        const claimed: Record<"storeCode" | "printerId", Map<string, number>> = {
          storeCode: new Map(),
          printerId: new Map(),
        };

        rows.forEach((cols, idx) => {
          const rowNum = idx + 2;
          const row: Record<string, string> = {};
          headers.forEach((h, i) => { row[h] = cols[i] ?? ""; });

          headers.filter((h) => !validImportCols.has(h)).forEach((col) =>
            errors.push({ row: rowNum, field: col, reason: `Unknown column "${col}" will be ignored` })
          );

          let hasError = false;

          if (!row.docId) {
            errors.push({ row: rowNum, field: "docId", reason: "docId is required to identify the store" });
            hasError = true;
          } else if (!existingStoreIds.includes(row.docId)) {
            errors.push({ row: rowNum, field: "docId", reason: "Store not found — cannot update" });
            hasError = true;
          }

          if (row.disable !== undefined && row.disable !== "" &&
            !["true", "false"].includes(row.disable.toLowerCase())) {
            errors.push({ row: rowNum, field: "disable", reason: 'Must be "true" or "false"' });
            hasError = true;
          }

          // Store code and printer ID must stay unique across all stores, and
          // across the file itself. The row's own store is excluded by docId.
          ([
            ["storeCode", "Store code"],
            ["printerId", "Printer ID"],
          ] as const).forEach(([field, label]) => {
            const raw = row[field];
            if (raw === undefined || raw.trim() === "") return;
            const key = raw.trim().toLowerCase();

            if (isStoreFieldTaken(existingStores, field, raw, row.docId)) {
              errors.push({ row: rowNum, field, reason: `${label} "${raw}" already exists` });
              hasError = true;
              return;
            }

            const claimedBy = claimed[field].get(key);
            if (claimedBy !== undefined) {
              errors.push({ row: rowNum, field, reason: `${label} "${raw}" duplicates row ${claimedBy}` });
              hasError = true;
              return;
            }
            claimed[field].set(key, rowNum);
          });

          if (!hasError) validRows.push(row);
        });

        setImportPreview({ validRows, errors });
      } catch {
        toast.error("Failed to read CSV file.");
      } finally {
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
    };
    reader.readAsText(file);
  }

  async function handleConfirmImport() {
    if (!importPreview || importPreview.validRows.length === 0) return;
    setImportLoading(true);
    try {
      let count = 0;
      for (const row of importPreview.validRows) {
        const update: Record<string, unknown> = {};
        if (row.name !== undefined && row.name !== "") update.name = row.name;
        if (row.address !== undefined && row.address !== "") update.address = row.address;
        if (row.email !== undefined && row.email !== "") update.email = row.email;
        if (row.contactNumber !== undefined && row.contactNumber !== "") update.contactNumber = row.contactNumber;
        if (row.location !== undefined && row.location !== "") update.location = row.location;
        if (row.imageUrl !== undefined) update.imageUrl = row.imageUrl || null;
        if (row.gstNumber !== undefined) update.gstNumber = row.gstNumber || null;
        if (row.invoiceText !== undefined) update.invoiceText = row.invoiceText || null;
        if (row.storeCode !== undefined) update.storeCode = row.storeCode;
        if (row.printerId !== undefined) update.printerId = row.printerId;
        if (row.disable !== undefined && row.disable !== "") update.disable = row.disable.toLowerCase() === "true";
        await StoreService.updateStore(row.docId, update);
        count++;
      }
      log({
        category: LOG_CATEGORY.IMPORT,
        severityLevel: LOG_SEVERITY.HIGH,
        action: "Import Stores",
        notes: `Admin updated ${count} store${count !== 1 ? "s" : ""} via CSV`,
        page: LOG_PAGE.STORES,
      });
      toast.success(`Updated ${count} store${count !== 1 ? "s" : ""}.`);
      setImportPreview(null);
    } catch {
      toast.error("Failed to import stores.");
    } finally {
      setImportLoading(false);
    }
  }

  async function handleDeleteStore() {
    if (!deleteStoreId) return;
    setDeleteLoading(true);
    // Resolved before the delete — the store leaves the list once it's gone.
    const storeName = stores.find((s) => s.docId === deleteStoreId)?.name ?? deleteStoreId;
    try {
      await StoreService.deleteStore(deleteStoreId);
      log({
        category: LOG_CATEGORY.STORES,
        severityLevel: LOG_SEVERITY.HIGH,
        action: "Delete Store",
        notes: `Admin deleted a store ${storeName}`,
        page: LOG_PAGE.STORES,
      });
      toast.success("Store deleted.");
      setDeleteStoreId(null);
    } catch (err) {
      console.error(err);
      toast.error("Failed to delete store. Please try again.");
    } finally {
      setDeleteLoading(false);
    }
  }

  async function handleToggleDisable(store: Store, checked: boolean) {
    try {
      await StoreService.updateStore(store.docId, { disable: !checked });
      log({
        category: LOG_CATEGORY.STORES,
        severityLevel: LOG_SEVERITY.HIGH,
        action: "Toggle Store Disabled",
        notes: `Admin ${checked ? "enabled" : "disabled"} a store ${store.name ?? store.docId}`,
        page: LOG_PAGE.STORES,
      });
      toast.success(checked ? "Store enabled." : "Store disabled.");
    } catch (err) {
      console.error(err);
      toast.error("Failed to update store. Please try again.");
    }
  }

  async function handleCreate() {
    const newErrors = Object.fromEntries(
      REQUIRED.filter((k) => !(form[k] as string).trim()).map((k) => [k, "Required."]),
    ) as FieldErrors;

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      toast.error("Please fill in all required fields.");
      return;
    }

    // Validate against every store, not the role-filtered list — a store manager
    // sees only their assigned stores and would miss collisions outside that scope.
    const dupErrors: FieldErrors = {};
    if (isStoreFieldTaken(allStores, "storeCode", form.storeCode)) {
      dupErrors.storeCode = "This store code is already in use.";
    }
    if (isStoreFieldTaken(allStores, "printerId", form.printerId)) {
      dupErrors.printerId = "This printer ID is already in use.";
    }
    if (Object.keys(dupErrors).length > 0) {
      setErrors(dupErrors);
      toast.error("Store code and printer ID must be unique.");
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

    const openingHours: Record<string, DayHours> = Object.fromEntries(
      DAYS.map((day) => {
        const { isOpen, open, close } = form.openingHours[day];
        return [day, { isOpen, open, close }];
      }),
    );

    setErrors({});
    setLoading(true);
    try {
      await StoreService.createStore({
        name: form.name.trim(),
        email: form.email.trim(),
        contactNumber: form.contactNumber.trim(),
        location: formatLocation(form.lat, form.lng),
        address: form.address.trim(),
        city: form.city.trim() || null,
        imageUrl: form.imageUrl.trim() || null,
        gstNumber: form.gstNumber.trim(),
        invoiceText: form.invoiceText.trim(),
        printerId: form.printerId.trim(),
        storeCode: form.storeCode.trim(),
        openingHours,
        disable: false,
      });
      log({
        category: LOG_CATEGORY.STORES,
        severityLevel: LOG_SEVERITY.HIGH,
        action: "Create Store",
        notes: `Admin added new store ${form.name.trim()}`,
        page: LOG_PAGE.STORES,
      });
      toast.success("Store created successfully.");
      closeDialog();
    } catch (err) {
      console.error(err);
      toast.error("Failed to create store. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-black">Stores</h1>
          <p className="mt-1 text-sm text-light-grey">
            {stores.length} store{stores.length !== 1 ? "s" : ""} total
          </p>
        </div>
        <div className="flex gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            onChange={handleImportCSV}
            className="hidden"
          />
{/* <Button
            variant="outline"
            size="sm"
            onClick={() => setShowImportInfo(true)}
            disabled={importLoading}
          >
            {importLoading ? "Importing…" : "Import CSV"}
          </Button> */}
          {isAdmin && (
            <Button
              variant="outline"
              onClick={exportToCSV}
              disabled={displayed.length === 0}
            >
              Export CSV
            </Button>
          )}
          {isAdmin && (
            <Button
              onClick={() => setShowCreate(true)}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-80"
            >
              + New Store
            </Button>
          )}
        </div>
      </div>

      <StoresFilterBar
        search={search} setSearch={setSearch}
        statusFilter={statusFilter} setStatusFilter={(v) => setStatusFilter(v as "All" | "Open" | "Closed" | "Disabled")}
        filterEmail={filterEmail} setFilterEmail={setFilterEmail}
        filterContactNumber={filterContactNumber} setFilterContactNumber={setFilterContactNumber}
        filterLocation={filterLocation} setFilterLocation={setFilterLocation}
        filterAddress={filterAddress} setFilterAddress={setFilterAddress}
        filterStoreCode={filterStoreCode} setFilterStoreCode={setFilterStoreCode}
        filterPrinterId={filterPrinterId} setFilterPrinterId={setFilterPrinterId}
        anyFilterActive={anyFilterActive}
        clearAllFilters={clearAllFilters}
      />

      <div className="overflow-hidden rounded-xl border border-border bg-white shadow-(--shadow)">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-background">
              <th
                onClick={() => toggleSort("name")}
                className="cursor-pointer select-none px-5 py-3 text-left font-medium text-light-grey hover:text-black"
              >
                Store {sortKey === "name" ? (sortDir === "asc" ? "↑" : "↓") : <span className="opacity-30">↕</span>}
              </th>
              <th className="px-5 py-3 text-left font-medium text-light-grey">Contact</th>
              <th className="px-5 py-3 text-left font-medium text-light-grey">Printer ID</th>
              <th
                onClick={() => toggleSort("status")}
                className="cursor-pointer select-none px-5 py-3 text-left font-medium text-light-grey hover:text-black"
              >
                Status {sortKey === "status" ? (sortDir === "asc" ? "↑" : "↓") : <span className="opacity-30">↕</span>}
              </th>
              <th className="px-5 py-3 text-left font-medium text-light-grey">Disabled</th>
              <th className="px-5 py-3 text-left font-medium text-light-grey">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {displayed.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-5 py-10 text-center text-light-grey">
                  No stores found.
                </td>
              </tr>
            ) : (
              displayed.map((store) => {
                const isOpen = isStoreOpenAt(store);
                const isDisabled = store.disable ?? false;

                return (
                  <tr
                    key={store.docId}
                    onClick={() => router.push(`/dashboard/stores/${store.docId}`)}
                    className="cursor-pointer transition-colors hover:bg-background"
                  >
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        {store.imageUrl ? (
                          <Image
                            src={store.imageUrl}
                            alt={store.name ?? "Store"}
                            width={36}
                            height={36}
                            className="rounded-lg object-cover"
                          />
                        ) : (
                          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-soft-grey text-xs font-bold text-light-grey">
                            {(store.name ?? "?")[0].toUpperCase()}
                          </div>
                        )}
                        <span className="font-medium text-black">{store.name ?? "—"}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3">
                      <div className="space-y-0.5">
                        <p className="text-black">{store.email ?? "—"}</p>
                        <p className="text-xs text-light-grey">{store.contactNumber ?? "—"}</p>
                      </div>
                    </td>
                    <td className="px-5 py-3 text-black">{store.printerId ?? "—"}</td>
                    <td className="px-5 py-3">
                      <EnumChip
                        domain="storeStatus"
                        value={isDisabled ? "Disabled" : isOpen ? "Open" : "Closed"}
                      />
                    </td>
                    <td className="px-5 py-3" onClick={(e) => e.stopPropagation()}>
                      {isAdmin ? (
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={!isDisabled}
                            onCheckedChange={(checked) => handleToggleDisable(store, checked)}
                          />
                        </div>
                      ) : (
                        <span className="text-sm text-light-grey">{isDisabled ? "Disabled" : "Enabled"}</span>
                      )}
                    </td>
                    <td className="px-5 py-3" onClick={(e) => e.stopPropagation()}>
                      {isAdmin ? (
                        <Button
                          size="xs"
                          variant="destructive"
                          onClick={() => setDeleteStoreId(store.docId)}
                        >
                          Delete
                        </Button>
                      ) : (
                        <span className="text-sm text-light-grey">—</span>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Create Store Dialog */}
      {showCreate && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={closeDialog}
        >
          <div
            className="w-full max-w-lg rounded-2xl bg-white shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="border-b border-border px-6 py-4">
              <h3 className="text-lg font-semibold text-black">New Store</h3>
            </div>

            <div className="max-h-[72vh] overflow-y-auto px-6 py-4 space-y-4">
              {/* Basic Info */}
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="mb-1.5 block text-xs text-light-grey">Name *</label>
                  <input
                    className={`w-full rounded-lg border px-3 py-2 text-sm text-black outline-none focus:border-primary ${errors.name ? "border-error" : "border-border"}`}
                    placeholder="e.g. Main Branch"
                    value={form.name}
                    onChange={(e) => setField("name", e.target.value)}
                  />
                  {errors.name && <p className="mt-1 text-xs text-error">{errors.name}</p>}
                </div>

                <ImageUploadField
                  value={form.imageUrl}
                  onChange={(url) => setField("imageUrl", url)}
                />

                <div>
                  <label className="mb-1.5 block text-xs text-light-grey">Email *</label>
                  <input
                    type="email"
                    className={`w-full rounded-lg border px-3 py-2 text-sm text-black outline-none focus:border-primary ${errors.email ? "border-error" : "border-border"}`}
                    placeholder="store@coffix.com"
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
                    placeholder="+63 9XX XXX XXXX"
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
                    placeholder="e.g. 123 Ayala Ave, Makati"
                    value={form.address}
                    onChange={(e) => setField("address", e.target.value)}
                  />
                  {errors.address && <p className="mt-1 text-xs text-error">{errors.address}</p>}
                </div>

                <div className="col-span-2">
                  <label className="mb-1.5 block text-xs text-light-grey">City</label>
                  <input
                    className="w-full rounded-lg border border-border px-3 py-2 text-sm text-black outline-none focus:border-primary"
                    placeholder="e.g. Makati"
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
                    placeholder="UAT"
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
                          htmlFor={`day-${day}`}
                          className="flex w-28 shrink-0 cursor-pointer items-center gap-2 text-sm font-medium text-black capitalize"
                        >
                          <Checkbox
                            id={`day-${day}`}
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
                onClick={handleCreate}
                disabled={loading}
              >
                {loading ? "Creating…" : "Create Store"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Store Confirmation Dialog */}
      <Dialog open={deleteStoreId !== null} onOpenChange={(open) => { if (!open) setDeleteStoreId(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Delete Store</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-black">
            Are you sure you want to delete{" "}
            <span className="font-medium">
              {stores.find((s) => s.docId === deleteStoreId)?.name ?? "this store"}
            </span>
            ? This action cannot be undone.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteStoreId(null)} disabled={deleteLoading}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDeleteStore} disabled={deleteLoading}>
              {deleteLoading ? "Deleting…" : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* CSV Field Guide Dialog */}
      <Dialog open={showImportInfo} onOpenChange={setShowImportInfo}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>CSV Import Guide — Stores</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2 text-sm">
            <div className="space-y-1.5">
              <p className="font-medium text-black">Editable fields</p>
              <div className="flex flex-wrap gap-1.5">
                {(["name", "address", "email", "contactNumber", "location", "imageUrl", "gstNumber", "invoiceText", "storeCode", "printerId", "disable"] as const).map((f) => (
                  <span key={f} className="rounded-md bg-background border border-border px-2 py-0.5 text-xs text-black font-mono">{f}</span>
                ))}
              </div>
            </div>
            <div className="space-y-1.5">
              <p className="font-medium text-black">Required fields <span className="text-xs font-normal text-light-grey">(for new rows)</span></p>
              <p className="text-xs text-light-grey">None — every row must include an existing <span className="font-mono text-black">docId</span>.</p>
            </div>
            <p className="text-xs text-light-grey leading-relaxed">
              This entity is <span className="font-medium text-black">update-only</span>. Every row must include a valid <span className="font-mono text-black">docId</span>. The <span className="font-mono text-black">disable</span> field accepts <span className="font-mono text-black">true</span> or <span className="font-mono text-black">false</span>.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowImportInfo(false)}>Cancel</Button>
            <Button onClick={() => { setShowImportInfo(false); fileInputRef.current?.click(); }}>
              Choose File →
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Import Preview Dialog */}
      <Dialog open={importPreview !== null} onOpenChange={() => setImportPreview(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Import Preview</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {importPreview && importPreview.errors.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-sm font-medium text-black">Errors</p>
                <div className="max-h-48 overflow-y-auto rounded-lg border border-border bg-background p-3 space-y-1">
                  {importPreview.errors.map((e, i) => (
                    <p key={i} className="text-xs text-black">
                      <span className="font-medium">Row {e.row}</span> — {e.field}: {e.reason}
                    </p>
                  ))}
                </div>
              </div>
            )}
            <p className="text-sm text-black">
              <span className="font-medium">{importPreview?.validRows.length ?? 0}</span> row(s) will be updated.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setImportPreview(null)} disabled={importLoading}>
              Cancel
            </Button>
            {(importPreview?.validRows.length ?? 0) > 0 && (
              <Button onClick={handleConfirmImport} disabled={importLoading}>
                {importLoading ? "Updating…" : `Update ${importPreview?.validRows.length} row(s)`}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
