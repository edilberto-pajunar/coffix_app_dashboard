"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import Image from "next/image";
import { useStoreStore } from "./store/useStoreStore";
import { useAuth } from "@/app/lib/AuthContext";
import { isStoreOpenAt, DayHours, Store, formatLocation, isValidCoordinate, isStoreFieldTaken } from "./interface/store";
import { StoreService } from "./service/StoreService";
import { useDashboardStore } from "../products/store/useDashboardStore";
import { productIdsReferencingStore } from "../products/interface/product";
import { useActivityLog } from "../logs/hooks/useActivityLog";
import { LOG_CATEGORY, LOG_PAGE, LOG_SEVERITY } from "../logs/constants/logConstants";
import {
  STORE_PROTECTED_FIELDS,
  STORE_IMPORTABLE_FIELDS,
  STORE_EXPORTABLE_FIELDS,
  STORE_REQUIRED_FIELDS,
} from "./constants/storeFieldConstants";
import { exportRowsToCSV } from "@/app/utils/import";
import { ImportCsvDialog, firstExampleRecord } from "@/components/import/ImportCsvDialog";
import { isFileError, parseImportFile } from "@/components/import/parseImportFile";
import type { ImportError, ImportPreview } from "@/components/import/types";
import { classifyDocIdTarget, validateDocIdFormat } from "@/components/import/storeRefs";
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

  const [importLoading, setImportLoading] = useState(false);
  const [importPreview, setImportPreview] = useState<ImportPreview | null>(null);
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

  /**
   * Builds a per-file validator. It is stateful: `claimed` tracks storeCode and
   * printerId values used by earlier rows, so an import cannot introduce
   * duplicates among its own rows either.
   */
  function makeStoreRowValidator() {
    const existingStores = useStoreStore.getState().stores;
    const existingStoreIds = existingStores.map((s) => s.docId);
    const allStoreIds = useStoreStore.getState().allStores.map((s) => s.docId);
    const claimed: Record<"storeCode" | "printerId", Map<string, number>> = {
      storeCode: new Map(),
      printerId: new Map(),
    };

    return function validateStoreRow(
      row: Record<string, string>,
      rowNum: number,
    ): ImportError[] {
      const errors: ImportError[] = [];
      const isCreate = !row.docId;

      // Format first: a wrong-entity ID gets a message naming the right section, instead
      // of the membership check's generic "not found". A soft-deleted target is not an
      // error — the row restores it on write. Only an unknown ID fails.
      const docIdFormatError = validateDocIdFormat(row.docId, "stores", rowNum);
      if (docIdFormatError) {
        errors.push(docIdFormatError);
      } else if (
        !isCreate &&
        classifyDocIdTarget(row.docId, existingStoreIds, allStoreIds) === "unknown"
      ) {
        errors.push({ row: rowNum, field: "docId", reason: "Store not found — cannot update" });
      }

      if (isCreate) {
        const missing = (STORE_REQUIRED_FIELDS as readonly string[]).filter(
          (f) => !row[f]?.trim(),
        );
        missing.forEach((f) =>
          errors.push({ row: rowNum, field: f, reason: `${f} is required for new stores` }),
        );
      }

      if (row.disable !== undefined && row.disable !== "" &&
        !["true", "false"].includes(row.disable.toLowerCase())) {
        errors.push({ row: rowNum, field: "disable", reason: 'Must be "true" or "false"' });
      }

      if (row.location !== undefined && row.location.trim() !== "") {
        const [lat, lng] = row.location.split(",").map((p) => p.trim());
        if (!isValidCoordinate(lat, 90) || !isValidCoordinate(lng, 180)) {
          errors.push({ row: rowNum, field: "location", reason: 'Must be "lat,lng" with valid coordinates' });
        }
      }

      // Store code and printer ID must stay unique across all stores, and across
      // the file itself. For updates the row's own store is excluded by docId;
      // for creates there is no document to exclude yet.
      ([
        ["storeCode", "Store code"],
        ["printerId", "Printer ID"],
      ] as const).forEach(([field, label]) => {
        const raw = row[field];
        if (raw === undefined || raw.trim() === "") return;
        const key = raw.trim().toLowerCase();

        if (isStoreFieldTaken(existingStores, field, raw, isCreate ? undefined : row.docId)) {
          errors.push({ row: rowNum, field, reason: `${label} "${raw}" already exists` });
          return;
        }

        const claimedBy = claimed[field].get(key);
        if (claimedBy !== undefined) {
          errors.push({ row: rowNum, field, reason: `${label} "${raw}" duplicates row ${claimedBy}` });
          return;
        }
        claimed[field].set(key, rowNum);
      });

      return errors;
    };
  }

  async function handleImportCSV(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (!file) return;

    const result = await parseImportFile(file, {
      protectedFields: STORE_PROTECTED_FIELDS,
      importableFields: STORE_IMPORTABLE_FIELDS,
      validateRow: makeStoreRowValidator(),
    });

    if (isFileError(result)) {
      toast.error(result.fileError);
      return;
    }
    setImportPreview(result);
  }

  async function handleConfirmImport() {
    const importable =
      importPreview?.rows.filter((r) => r.action !== "error") ?? [];
    if (importable.length === 0) return;
    setImportLoading(true);
    try {
      let created = 0;
      let updated = 0;
      for (const { action, data: row } of importable) {
        const data: Record<string, unknown> = {};
        if (row.name !== undefined && row.name !== "") data.name = row.name;
        if (row.address !== undefined && row.address !== "") data.address = row.address;
        if (row.email !== undefined && row.email !== "") data.email = row.email;
        if (row.contactNumber !== undefined && row.contactNumber !== "") data.contactNumber = row.contactNumber;
        if (row.location !== undefined && row.location !== "") data.location = row.location;
        if (row.imageUrl !== undefined) data.imageUrl = row.imageUrl || null;
        if (row.gstNumber !== undefined) data.gstNumber = row.gstNumber || null;
        if (row.invoiceText !== undefined) data.invoiceText = row.invoiceText || null;
        if (row.storeCode !== undefined) data.storeCode = row.storeCode;
        if (row.printerId !== undefined) data.printerId = row.printerId;
        if (row.disable !== undefined && row.disable !== "") data.disable = row.disable.toLowerCase() === "true";

        if (action === "update") {
          // Clearing the soft-delete flags restores a store deleted after the CSV was
          // exported; on a live store it is a no-op. Products it was detached from on
          // delete are not re-attached — the delete cascade is not reversed here.
          await StoreService.updateStore(row.docId, {
            ...data,
            isDeleted: false,
            deletedAt: null,
          });
          updated++;
        } else {
          // A CSV cannot express opening hours, so new stores start closed every
          // day on the same defaults the Create Store dialog uses. Edit the
          // store afterwards to set real hours.
          const openingHours: Record<string, DayHours> = Object.fromEntries(
            DAYS.map((day) => [day, { ...defaultDayHours }]),
          );
          await StoreService.createStore({
            ...data,
            city: row.city?.trim() || null,
            openingHours,
            disable: data.disable ?? false,
          } as Omit<Store, "docId">);
          created++;
        }
      }
      log({
        category: LOG_CATEGORY.IMPORT,
        severityLevel: LOG_SEVERITY.HIGH,
        action: "Import Stores",
        notes: `Admin created ${created} and updated ${updated} store(s) via CSV`,
        page: LOG_PAGE.STORES,
      });
      toast.success(`Created ${created} and updated ${updated} store(s).`);
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
    // Products aren't subscribed to on this page; the dashboard layout mounts the
    // listener globally, so the store is populated by the time a delete is possible.
    const affectedProductIds = productIdsReferencingStore(
      useDashboardStore.getState().products,
      deleteStoreId,
    );
    try {
      await StoreService.deleteStoreCascade(deleteStoreId, affectedProductIds);
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
          {isAdmin && (
            <Button
              variant="outline"
              onClick={() => setShowImportInfo(true)}
              disabled={importLoading}
            >
              {importLoading ? "Importing…" : "Import CSV"}
            </Button>
          )}
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

      <ImportCsvDialog
        entityLabel="Stores"
        idCollection="stores"
        exampleRecord={firstExampleRecord(stores)}
        guideOpen={showImportInfo}
        onGuideOpenChange={setShowImportInfo}
        guide={{
          editable: STORE_IMPORTABLE_FIELDS,
          required: STORE_REQUIRED_FIELDS,
          note: (
            <p className="text-xs leading-relaxed text-light-grey">
              <span className="font-mono text-black">location</span> is{" "}
              <span className="font-mono text-black">lat,lng</span>;{" "}
              <span className="font-mono text-black">disable</span> accepts{" "}
              <span className="font-mono text-black">true</span> or{" "}
              <span className="font-mono text-black">false</span>. New stores are
              created closed every day — set opening hours by editing the store
              afterwards.
            </p>
          ),
        }}
        onChooseFile={() => fileInputRef.current?.click()}
        preview={importPreview}
        onPreviewClose={() => setImportPreview(null)}
        loading={importLoading}
        onConfirm={handleConfirmImport}
      />
    </div>
  );
}
