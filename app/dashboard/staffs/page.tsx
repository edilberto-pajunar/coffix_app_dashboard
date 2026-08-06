"use client";

import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { useStaffStore } from "./store/useStaffStore";
import { useStoreStore } from "@/app/dashboard/stores/store/useStoreStore";
import { StaffService } from "./service/StaffService";
import { Staff, StaffRole } from "./interface/staff";
import { Store } from "@/app/dashboard/stores/interface/store";
import {
  STAFF_PROTECTED_FIELDS,
  STAFF_IMPORTABLE_FIELDS,
  STAFF_EXPORTABLE_FIELDS,
} from "./constants/staffFieldConstants";
import { parseCSVText } from "@/app/utils/csvUtils";
import { partitionIdCell } from "@/components/import/storeRefs";
import { exportRowsToCSV } from "@/app/utils/import";
import { SYSTEM_IMPORT_FIELDS } from "@/components/import/parseImportFile";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { StaffsFilterBar } from "./components/StaffsFilterBar";
import { useActivityLog } from "../logs/hooks/useActivityLog";
import { LOG_CATEGORY, LOG_PAGE, LOG_SEVERITY } from "../logs/constants/logConstants";

// ─── Form types ───────────────────────────────────────────────────────────────

type StaffForm = {
  firstName: string;
  lastName: string;
  email: string;
  role: StaffRole | "";
  storeIds: string[];
  disabled: boolean;
};

type StaffFormErrors = {
  email?: boolean;
  role?: boolean;
  storeIds?: boolean;
};

const emptyForm: StaffForm = {
  firstName: "",
  lastName: "",
  email: "",
  role: "",
  storeIds: [],
  disabled: false,
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validateForm(form: StaffForm): StaffFormErrors {
  return {
    email: !form.email.trim() || !EMAIL_RE.test(form.email.trim()),
    role: !form.role,
    storeIds: form.role === "store_manager" && form.storeIds.length === 0,
  };
}

function hasErrors(errors: StaffFormErrors): boolean {
  return Object.values(errors).some(Boolean);
}

function toggleStoreId(currentIds: string[], storeId: string): string[] {
  return currentIds.includes(storeId)
    ? currentIds.filter((id) => id !== storeId)
    : [...currentIds, storeId];
}

// ─── Dialog sub-component ─────────────────────────────────────────────────────

type StaffDialogProps = {
  title: string;
  form: StaffForm;
  errors: StaffFormErrors;
  loading: boolean;
  stores: Store[];
  isEdit: boolean;
  onClose: () => void;
  onSubmit: () => void;
  onChangeFirstName: (v: string) => void;
  onChangeLastName: (v: string) => void;
  onChangeEmail: (v: string) => void;
  onChangeRole: (v: StaffRole | "") => void;
  onToggleStore: (storeId: string) => void;
  onChangeDisabled: (v: boolean) => void;
  onSelectAll: () => void;
  onUnselectAll: () => void;
};

function StaffDialog({
  title,
  form,
  errors,
  loading,
  stores,
  isEdit,
  onClose,
  onSubmit,
  onChangeFirstName,
  onChangeLastName,
  onChangeEmail,
  onChangeRole,
  onToggleStore,
  onChangeDisabled,
  onSelectAll,
  onUnselectAll,
}: StaffDialogProps) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="border-b border-border px-6 py-4">
          <h3 className="text-lg font-semibold text-black">{title}</h3>
        </div>

        <div className="max-h-[72vh] space-y-4 overflow-y-auto px-6 py-4">
          {/* First Name & Last Name */}
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="mb-1.5 block text-xs text-light-grey">First Name</label>
              <input
                type="text"
                value={form.firstName}
                onChange={(e) => onChangeFirstName(e.target.value)}
                placeholder="John"
                className="w-full rounded-lg border border-border px-3 py-2 text-sm text-black outline-none focus:border-primary"
              />
            </div>
            <div className="flex-1">
              <label className="mb-1.5 block text-xs text-light-grey">Last Name</label>
              <input
                type="text"
                value={form.lastName}
                onChange={(e) => onChangeLastName(e.target.value)}
                placeholder="Doe"
                className="w-full rounded-lg border border-border px-3 py-2 text-sm text-black outline-none focus:border-primary"
              />
            </div>
          </div>

          {/* Email */}
          <div>
            <label className="mb-1.5 block text-xs text-light-grey">Email *</label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => onChangeEmail(e.target.value)}
              placeholder="staff@coffix.com"
              className={`w-full rounded-lg border px-3 py-2 text-sm text-black outline-none focus:border-primary ${
                errors.email ? "border-error" : "border-border"
              }`}
              readOnly={isEdit}
            />
            {errors.email && (
              <p className="mt-1 text-xs text-error">Valid email is required.</p>
            )}
          </div>

          {/* Role */}
          <div>
            <label className="mb-1.5 block text-xs text-light-grey">Role *</label>
            <select
              value={form.role}
              onChange={(e) => onChangeRole(e.target.value as StaffRole | "")}
              className={`w-full rounded-lg border px-3 py-2 text-sm text-black outline-none focus:border-primary ${
                errors.role ? "border-error" : "border-border"
              }`}
            >
              <option value="">Select a role…</option>
              <option value="admin">Admin</option>
              <option value="store_manager">Store Manager</option>
            </select>
            {errors.role && (
              <p className="mt-1 text-xs text-error">Role is required.</p>
            )}
          </div>

          {/* Assigned Stores — for store_manager and admin */}
          {(form.role === "store_manager" ) && (
            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <label className="text-xs text-light-grey">Assigned Stores *</label>
                {stores.length > 0 && (
                  <div className="flex gap-2">
                    <Button type="button" variant="link" size="xs" onClick={onSelectAll}>
                      Select all
                    </Button>
                    <span className="text-xs text-light-grey">·</span>
                    <Button type="button" variant="ghost" size="xs" onClick={onUnselectAll}>
                      Unselect all
                    </Button>
                  </div>
                )}
              </div>
              <div
                className={`overflow-hidden rounded-lg border divide-y divide-border ${
                  errors.storeIds ? "border-error" : "border-border"
                }`}
              >
                {stores.length === 0 ? (
                  <p className="px-3 py-2 text-xs text-light-grey">
                    No stores available.
                  </p>
                ) : (
                  stores.map((store) => (
                    <label
                      key={store.docId}
                      htmlFor={`staff-store-${store.docId}`}
                      className="flex cursor-pointer items-center gap-3 px-3 py-2.5 hover:bg-background"
                    >
                      <Checkbox
                        id={`staff-store-${store.docId}`}
                        checked={form.storeIds.includes(store.docId)}
                        onCheckedChange={() => onToggleStore(store.docId)}
                      />
                      <span className="text-sm text-black">
                        {store.name ?? store.docId}
                      </span>
                    </label>
                  ))
                )}
              </div>
              {errors.storeIds && (
                <p className="mt-1 text-xs text-error">
                  At least one store must be assigned.
                </p>
              )}
            </div>
          )}

          {/* Disabled — only in edit mode */}
          {isEdit && (
            <label htmlFor="staff-disabled" className="flex cursor-pointer items-center gap-3">
              <Checkbox
                id="staff-disabled"
                checked={form.disabled}
                onCheckedChange={(c) => onChangeDisabled(c === true)}
              />
              <span className="text-sm text-black">Disabled</span>
            </label>
          )}
        </div>

        <div className="flex justify-end gap-2 border-t border-border px-6 py-4">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={onSubmit} disabled={loading}>
            {loading
              ? isEdit
                ? "Saving…"
                : "Creating…"
              : isEdit
                ? "Save Changes"
                : "Create Staff"}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Page component ───────────────────────────────────────────────────────────

export default function StaffsPage() {
  const staffs = useStaffStore((s) => s.staffs);
  const stores = useStoreStore((s) => s.stores);

  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<"All" | "admin" | "store_manager">("All");
  const [statusFilter, setStatusFilter] = useState<"All" | "Enabled" | "Disabled">("All");

  const anyFilterActive = useMemo(
    () => search.trim() !== "" || roleFilter !== "All" || statusFilter !== "All",
    [search, roleFilter, statusFilter]
  );

  function clearAllFilters() {
    setSearch("");
    setRoleFilter("All");
    setStatusFilter("All");
  }
  type StaffSortKey = "email" | "role" | "status";
  type SortDir = "asc" | "desc";
  const [sortKey, setSortKey] = useState<StaffSortKey>("email");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  function toggleSort(key: StaffSortKey) {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("asc"); }
  }

  const displayed = useMemo(() => {
    const q = search.trim().toLowerCase();
    let result = staffs.filter((s) => {
      if (roleFilter !== "All" && s.role !== roleFilter) return false;
      if (statusFilter !== "All") {
        if (statusFilter === "Enabled" && s.disabled) return false;
        if (statusFilter === "Disabled" && !s.disabled) return false;
      }
      if (q && !s.email.toLowerCase().includes(q)) return false;
      return true;
    });
    result = [...result].sort((a, b) => {
      let cmp = 0;
      if (sortKey === "email") cmp = a.email.localeCompare(b.email);
      else if (sortKey === "role") cmp = a.role.localeCompare(b.role);
      else cmp = Number(a.disabled) - Number(b.disabled);
      return sortDir === "asc" ? cmp : -cmp;
    });
    return result;
  }, [staffs, search, roleFilter, statusFilter, sortKey, sortDir]);

  const [importLoading, setImportLoading] = useState(false);
  const [importPreview, setImportPreview] = useState<{ validRows: Record<string, string>[]; errors: { row: number; field: string; reason: string }[] } | null>(null);
  const [showImportInfo, setShowImportInfo] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function exportToCSV() {
    const date = new Date().toISOString().slice(0, 10);
    exportRowsToCSV(displayed, STAFF_EXPORTABLE_FIELDS, "staffs", `${date}-users.csv`);
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
          (STAFF_PROTECTED_FIELDS as readonly string[]).includes(h) &&
          !(SYSTEM_IMPORT_FIELDS as readonly string[]).includes(h)
        );
        if (protectedInFile.length > 0) {
          toast.error(`CSV contains protected columns: ${protectedInFile.join(", ")}. Remove them and re-upload.`);
          if (fileInputRef.current) fileInputRef.current.value = "";
          return;
        }

        const existingStaffIds = useStaffStore.getState().staffs.map((s) => s.docId!);
        const storeIds = useStoreStore.getState().stores.map((s) => s.docId!);
        const allStoreIds = useStoreStore.getState().allStores.map((s) => s.docId!);
        const validImportCols = new Set([...(STAFF_IMPORTABLE_FIELDS as readonly string[]), ...(SYSTEM_IMPORT_FIELDS as readonly string[])]);

        const validRows: Record<string, string>[] = [];
        const errors: { row: number; field: string; reason: string }[] = [];

        rows.forEach((cols, idx) => {
          const rowNum = idx + 2;
          const row: Record<string, string> = {};
          headers.forEach((h, i) => { row[h] = cols[i] ?? ""; });

          headers.filter((h) => !validImportCols.has(h)).forEach((col) =>
            errors.push({ row: rowNum, field: col, reason: `Unknown column "${col}" will be ignored` })
          );

          let hasError = false;

          if (!row.docId) {
            errors.push({ row: rowNum, field: "docId", reason: "docId is required to identify the staff member" });
            hasError = true;
          } else if (!existingStaffIds.includes(row.docId)) {
            errors.push({ row: rowNum, field: "docId", reason: "Staff not found — cannot update" });
            hasError = true;
          }

          if (row.role && !["admin", "store_manager"].includes(row.role)) {
            errors.push({ row: rowNum, field: "role", reason: 'Must be "admin" or "store_manager"' });
            hasError = true;
          }

          // Soft-deleted stores are dropped on write, so only unknown IDs fail here.
          if (row.storeIds) {
            const { unknown } = partitionIdCell(row.storeIds, storeIds, allStoreIds);
            if (unknown.length > 0) {
              errors.push({ row: rowNum, field: "storeIds", reason: `Store(s) not found: ${unknown.join(", ")}` });
              hasError = true;
            }
          }

          if (row.disabled !== undefined && row.disabled !== "" &&
            !["true", "false"].includes(row.disabled.toLowerCase())) {
            errors.push({ row: rowNum, field: "disabled", reason: 'Must be "true" or "false"' });
            hasError = true;
          }

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
      const liveStoreIds = useStoreStore.getState().stores.map((s) => s.docId!);
      const allStoreIds = useStoreStore.getState().allStores.map((s) => s.docId!);

      for (const row of importPreview.validRows) {
        const update: Partial<Omit<Staff, "docId">> = {};
        if (row.role) update.role = row.role as StaffRole;
        // Only live IDs are written — references to soft-deleted stores are dropped.
        if (row.storeIds !== undefined)
          update.storeIds = partitionIdCell(row.storeIds, liveStoreIds, allStoreIds).live;
        if (row.disabled !== undefined && row.disabled !== "") update.disabled = row.disabled.toLowerCase() === "true";
        if (row.firstName !== undefined) update.firstName = row.firstName;
        if (row.lastName !== undefined) update.lastName = row.lastName;
        await StaffService.updateStaff(row.docId, update);
        count++;
      }
      log({
        category: LOG_CATEGORY.IMPORT,
        severityLevel: LOG_SEVERITY.HIGH,
        action: "Import Staff",
        notes: `Admin updated ${count} staff member${count !== 1 ? "s" : ""} via CSV`,
        page: LOG_PAGE.USERS,
      });
      toast.success(`Updated ${count} staff member(s).`);
      setImportPreview(null);
    } catch {
      toast.error("Failed to import staff.");
    } finally {
      setImportLoading(false);
    }
  }

  // Create dialog state
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState<StaffForm>(emptyForm);
  const [createErrors, setCreateErrors] = useState<StaffFormErrors>({});
  const [createLoading, setCreateLoading] = useState(false);
  const { log } = useActivityLog();

  // Edit dialog state
  const [editTarget, setEditTarget] = useState<Staff | null>(null);
  const [editForm, setEditForm] = useState<StaffForm>(emptyForm);
  const [editErrors, setEditErrors] = useState<StaffFormErrors>({});
  const [editLoading, setEditLoading] = useState(false);

  // ── Create handlers
  function openCreate() {
    setCreateForm(emptyForm);
    setCreateErrors({});
    setShowCreate(true);
  }

  function closeCreate() {
    setShowCreate(false);
    setCreateForm(emptyForm);
    setCreateErrors({});
  }

  async function handleCreate() {
    const errs = validateForm(createForm);
    if (hasErrors(errs)) {
      setCreateErrors(errs);
      toast.error("Please fix the errors before submitting.");
      return;
    }
    setCreateLoading(true);
    try {
      await StaffService.createStaff({
        firstName: createForm.firstName.trim(),
        lastName: createForm.lastName.trim(),
        email: createForm.email.trim(),
        role: createForm.role as StaffRole,
        storeIds: createForm.role === "admin"
          ? stores.map((s) => s.docId)
          : createForm.storeIds,
        disabled: false,
      });
      log({
        category: LOG_CATEGORY.USERS,
        severityLevel: LOG_SEVERITY.HIGH,
        action: "Create Staff User",
        notes: `Admin created a staff ${createForm.email.trim()} (role ${createForm.role})`,
        page: LOG_PAGE.USERS,
      });
      toast.success("Staff member created.");
      closeCreate();
    } catch (err) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : "Failed to create staff. Please try again.");
    } finally {
      setCreateLoading(false);
    }
  }

  // ── Edit handlers
  function openEdit(staff: Staff) {
    setEditTarget(staff);
    setEditForm({
      firstName: staff.firstName ?? "",
      lastName: staff.lastName ?? "",
      email: staff.email,
      role: staff.role,
      storeIds: staff.storeIds ?? [],
      disabled: staff.disabled,
    });
    setEditErrors({});
  }

  function closeEdit() {
    setEditTarget(null);
    setEditForm(emptyForm);
    setEditErrors({});
  }

  async function handleUpdate() {
    if (!editTarget) return;
    const errs = validateForm(editForm);
    if (hasErrors(errs)) {
      setEditErrors(errs);
      toast.error("Please fix the errors before submitting.");
      return;
    }
    setEditLoading(true);
    try {
      await StaffService.updateStaff(editTarget.docId, {
        firstName: editForm.firstName.trim(),
        lastName: editForm.lastName.trim(),
        email: editForm.email.trim(),
        role: editForm.role as StaffRole,
        storeIds: editForm.storeIds,
        disabled: editForm.disabled,
      });
      log({
        category: LOG_CATEGORY.USERS,
        severityLevel: LOG_SEVERITY.HIGH,
        action: "Edit Staff User",
        notes: `Admin edited a staff ${editForm.email.trim()} (role/store assignment)`,
        page: LOG_PAGE.USERS,
      });
      toast.success("User updated.");
      closeEdit();
    } catch (err) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : "Failed to update user. Please try again.");
    } finally {
      setEditLoading(false);
    }
  }

  // ── Delete handler
  async function handleDelete(staff: Staff) {
    if (!window.confirm(`Delete ${staff.email}? This cannot be undone.`)) return;
    try {
      await StaffService.deleteStaff(staff.docId);
      log({
        category: LOG_CATEGORY.USERS,
        severityLevel: LOG_SEVERITY.HIGH,
        action: "Delete Staff User",
        notes: `Admin deleted a staff ${staff.email}`,
        page: LOG_PAGE.USERS,
      });
      toast.success("User deleted.");
    } catch (err) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : "Failed to delete user.");
    }
  }

  // ── Utility: look up store names for display
  function storeNames(ids: string[] | undefined): string {
    if (!ids || ids.length === 0) return "N/A";
    const names = ids
      .map((id) => stores.find((s) => s.docId === id)?.name)
      .filter((name): name is string => Boolean(name))
      .join(", ");
    return names || "N/A";
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-black">Users</h1>
          <p className="mt-1 text-sm text-light-grey">
            {staffs.length} user{staffs.length !== 1 ? "s" : ""} total
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
          <div className="flex gap-2">
          <Button variant="outline"  onClick={exportToCSV}>Export CSV</Button>
          <Button onClick={openCreate}>
              + New User
            </Button>
        </div>
        </div>
      </div>

      <StaffsFilterBar
        search={search} setSearch={setSearch}
        roleFilter={roleFilter} setRoleFilter={setRoleFilter}
        statusFilter={statusFilter} setStatusFilter={setStatusFilter}
        anyFilterActive={anyFilterActive}
        clearAllFilters={clearAllFilters}
      />

      {/* Table */}
      <div className="overflow-hidden rounded-xl border border-border bg-white shadow-(--shadow)">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-background">
              <th className="px-5 py-3 text-left font-medium text-light-grey">Full Name</th>
              <th
                onClick={() => toggleSort("email")}
                className="cursor-pointer select-none px-5 py-3 text-left font-medium text-light-grey hover:text-black"
              >
                Email {sortKey === "email" ? (sortDir === "asc" ? "↑" : "↓") : <span className="opacity-30">↕</span>}
              </th>
              <th
                onClick={() => toggleSort("role")}
                className="cursor-pointer select-none px-5 py-3 text-left font-medium text-light-grey hover:text-black"
              >
                Role {sortKey === "role" ? (sortDir === "asc" ? "↑" : "↓") : <span className="opacity-30">↕</span>}
              </th>
              <th className="px-5 py-3 text-left font-medium text-light-grey">Assigned Stores</th>
              <th
                onClick={() => toggleSort("status")}
                className="cursor-pointer select-none px-5 py-3 text-left font-medium text-light-grey hover:text-black"
              >
                Status {sortKey === "status" ? (sortDir === "asc" ? "↑" : "↓") : <span className="opacity-30">↕</span>}
              </th>
              <th className="px-5 py-3 text-right font-medium text-light-grey">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {displayed.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-5 py-10 text-center text-light-grey">
                  No users found.
                </td>
              </tr>
            ) : (
              displayed.map((staff) => (
                <tr key={staff.docId} onClick={() => openEdit(staff)} className="cursor-pointer transition-colors hover:bg-background">
                  <td className="px-5 py-3 text-black">
                    {[staff.firstName, staff.lastName].filter(Boolean).join(" ") || "—"}
                  </td>
                  <td className="px-5 py-3 text-black">{staff.email}</td>

                  <td className="px-5 py-3">
                    {staff.role === "admin" ? (
                      <span className="inline-flex items-center justify-center gap-1.5 rounded-full bg-primary/10 min-w-32 px-2.5 py-1 text-xs font-medium text-primary">
                        Admin
                      </span>
                    ) : (
                      <span className="inline-flex items-center justify-center gap-1.5 rounded-full bg-black min-w-32 px-2.5 py-1 text-xs font-medium text-white">
                        Store Manager
                      </span>
                    )}
                  </td>

                  <td className="px-5 py-3 text-black">
                    {staff.role === "admin" ? "All Stores" : storeNames(staff.storeIds)}
                  </td>

                  <td className="px-5 py-3">
                    {staff.disabled ? (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-black px-2.5 py-1 text-xs font-medium text-white">
                        <span className="h-1.5 w-1.5 rounded-full bg-white" />
                        Disabled
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-green-50 px-2.5 py-1 text-xs font-medium text-success">
                        <span className="h-1.5 w-1.5 rounded-full bg-success" />
                        Enabled
                      </span>
                    )}
                  </td>

                  <td className="px-5 py-3">
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={(e) => { e.stopPropagation(); handleDelete(staff); }}
                      >
                        Delete
                      </Button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Create Dialog */}
      {showCreate && (
        <StaffDialog
          title="New User"
          form={createForm}
          errors={createErrors}
          loading={createLoading}
          stores={stores}
          isEdit={false}
          onClose={closeCreate}
          onSubmit={handleCreate}
          onChangeFirstName={(v) => setCreateForm((f) => ({ ...f, firstName: v }))}
          onChangeLastName={(v) => setCreateForm((f) => ({ ...f, lastName: v }))}
          onChangeEmail={(v) => {
            setCreateForm((f) => ({ ...f, email: v }));
            setCreateErrors((e) => ({ ...e, email: false }));
          }}
          onChangeRole={(v) => {
            setCreateForm((f) => ({ ...f, role: v, storeIds: [] }));
            setCreateErrors((e) => ({ ...e, role: false, storeIds: false }));
          }}
          onToggleStore={(id) => {
            setCreateForm((f) => ({ ...f, storeIds: toggleStoreId(f.storeIds, id) }));
            setCreateErrors((e) => ({ ...e, storeIds: false }));
          }}
          onSelectAll={() => {
            setCreateForm((f) => ({ ...f, storeIds: stores.map((s) => s.docId) }));
            setCreateErrors((e) => ({ ...e, storeIds: false }));
          }}
          onUnselectAll={() => {
            setCreateForm((f) => ({ ...f, storeIds: [] }));
          }}
          onChangeDisabled={() => {}}
        />
      )}

      {/* Edit Dialog */}
      {editTarget && (
        <StaffDialog
          title="Edit User"
          form={editForm}
          errors={editErrors}
          loading={editLoading}
          stores={stores}
          isEdit={true}
          onClose={closeEdit}
          onSubmit={handleUpdate}
          onChangeFirstName={(v) => setEditForm((f) => ({ ...f, firstName: v }))}
          onChangeLastName={(v) => setEditForm((f) => ({ ...f, lastName: v }))}
          onChangeEmail={(v) => {
            setEditForm((f) => ({ ...f, email: v }));
            setEditErrors((e) => ({ ...e, email: false }));
          }}
          onChangeRole={(v) => {
            setEditForm((f) => ({ ...f, role: v, storeIds: [] }));
            setEditErrors((e) => ({ ...e, role: false, storeIds: false }));
          }}
          onToggleStore={(id) => {
            setEditForm((f) => ({ ...f, storeIds: toggleStoreId(f.storeIds, id) }));
            setEditErrors((e) => ({ ...e, storeIds: false }));
          }}
          onSelectAll={() => {
            setEditForm((f) => ({ ...f, storeIds: stores.map((s) => s.docId) }));
            setEditErrors((e) => ({ ...e, storeIds: false }));
          }}
          onUnselectAll={() => {
            setEditForm((f) => ({ ...f, storeIds: [] }));
          }}
          onChangeDisabled={(v) => {
            setEditForm((f) => ({ ...f, disabled: v }));
          }}
        />
      )}

      {/* CSV Field Guide Dialog */}
      <Dialog open={showImportInfo} onOpenChange={setShowImportInfo}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>CSV Import Guide — Users</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2 text-sm">
            <div className="space-y-1.5">
              <p className="font-medium text-black">Editable fields</p>
              <div className="flex flex-wrap gap-1.5">
                {(["role", "storeIds", "disabled", "firstName", "lastName"] as const).map((f) => (
                  <span key={f} className="rounded-md bg-background border border-border px-2 py-0.5 text-xs text-black font-mono">{f}</span>
                ))}
              </div>
            </div>
            <div className="space-y-1.5">
              <p className="font-medium text-black">Required fields <span className="text-xs font-normal text-light-grey">(for new rows)</span></p>
              <p className="text-xs text-light-grey">None — every row must include an existing <span className="font-mono text-black">docId</span>.</p>
            </div>
            <p className="text-xs text-light-grey leading-relaxed">
              This entity is <span className="font-medium text-black">update-only</span>. Every row must include a valid <span className="font-mono text-black">docId</span>. The <span className="font-mono text-black">storeIds</span> field uses <span className="font-mono text-black">|</span> as separator. The <span className="font-mono text-black">role</span> field accepts <span className="font-mono text-black">admin</span> or <span className="font-mono text-black">store_manager</span>.
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
