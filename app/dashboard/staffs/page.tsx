"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { useStaffStore } from "./store/useStaffStore";
import { useStoreStore } from "@/app/dashboard/stores/store/useStoreStore";
import { StaffService } from "./service/StaffService";
import { Staff, StaffRole } from "./interface/staff";
import { Store } from "@/app/dashboard/stores/interface/store";

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
                    <button
                      type="button"
                      onClick={onSelectAll}
                      className="text-xs text-primary hover:underline"
                    >
                      Select all
                    </button>
                    <span className="text-xs text-light-grey">·</span>
                    <button
                      type="button"
                      onClick={onUnselectAll}
                      className="text-xs text-light-grey hover:underline"
                    >
                      Unselect all
                    </button>
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
                      className="flex cursor-pointer items-center gap-3 px-3 py-2.5 hover:bg-background"
                    >
                      <input
                        type="checkbox"
                        checked={form.storeIds.includes(store.docId)}
                        onChange={() => onToggleStore(store.docId)}
                        className="accent-primary"
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
            <label className="flex cursor-pointer items-center gap-3">
              <input
                type="checkbox"
                checked={form.disabled}
                onChange={(e) => onChangeDisabled(e.target.checked)}
                className="accent-primary"
              />
              <span className="text-sm text-black">Disabled</span>
            </label>
          )}
        </div>

        <div className="flex justify-end gap-2 border-t border-border px-6 py-4">
          <button
            onClick={onClose}
            className="rounded-lg border border-border px-4 py-2 text-sm text-black hover:bg-[#f0f0f0]"
          >
            Cancel
          </button>
          <button
            onClick={onSubmit}
            disabled={loading}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:opacity-80 disabled:opacity-50"
          >
            {loading
              ? isEdit
                ? "Saving…"
                : "Creating…"
              : isEdit
                ? "Save Changes"
                : "Create Staff"}
          </button>
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

  // Create dialog state
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState<StaffForm>(emptyForm);
  const [createErrors, setCreateErrors] = useState<StaffFormErrors>({});
  const [createLoading, setCreateLoading] = useState(false);

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
      toast.success("Staff member created.");
      closeCreate();
    } catch (err) {
      console.error(err);
      toast.error("Failed to create staff. Please try again.");
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
      toast.success("Staff member updated.");
      closeEdit();
    } catch (err) {
      console.error(err);
      toast.error("Failed to update staff. Please try again.");
    } finally {
      setEditLoading(false);
    }
  }

  // ── Delete handler
  async function handleDelete(staff: Staff) {
    if (!window.confirm(`Delete ${staff.email}? This cannot be undone.`)) return;
    try {
      await StaffService.deleteStaff(staff.docId);
      toast.success("Staff member deleted.");
    } catch (err) {
      console.error(err);
      toast.error("Failed to delete staff.");
    }
  }

  // ── Utility: look up store names for display
  function storeNames(ids: string[] | undefined): string {
    if (!ids || ids.length === 0) return "—";
    return ids
      .map((id) => stores.find((s) => s.docId === id)?.name ?? id)
      .join(", ");
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-black">Staff</h1>
          <p className="mt-1 text-sm text-light-grey">
            {staffs.length} staff member{staffs.length !== 1 ? "s" : ""} total
          </p>
        </div>
        <button
          onClick={openCreate}
          className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-80"
        >
          + New Staff
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <input
          type="text"
          placeholder="Search by email…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-9 w-full rounded-lg border border-border bg-white px-3 text-sm text-black outline-none placeholder:text-light-grey focus:border-primary sm:max-w-xs"
        />
        <div className="flex flex-wrap gap-2">
          {(["All", "admin", "store_manager"] as const).map((v) => (
            <button
              key={v}
              onClick={() => setRoleFilter(v)}
              className={`rounded-full border px-3 py-1 text-xs transition-colors ${roleFilter === v ? "border-primary bg-primary text-white" : "border-border text-black hover:bg-soft-grey"}`}
            >
              {v === "All" ? "All Roles" : v === "admin" ? "Admin" : "Store Manager"}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          {(["All", "Enabled", "Disabled"] as const).map((v) => (
            <button
              key={v}
              onClick={() => setStatusFilter(v)}
              className={`rounded-full border px-3 py-1 text-xs transition-colors ${statusFilter === v ? "border-primary bg-primary text-white" : "border-border text-black hover:bg-soft-grey"}`}
            >
              {v === "All" ? "All Statuses" : v}
            </button>
          ))}
        </div>
      </div>

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
                  No staff members found.
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
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
                        Admin
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-black px-2.5 py-1 text-xs font-medium text-white">
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
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDelete(staff); }}
                        className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-error transition-colors hover:border-error hover:bg-red-50"
                      >
                        Delete
                      </button>
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
          title="New Staff"
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
          title="Edit Staff"
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
    </div>
  );
}
